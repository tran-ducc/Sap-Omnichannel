import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChannelListingState, ChannelSyncedEvent } from "@omni/shared";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaService } from "../../prisma/prisma.module";
import { NotificationsService } from "../notifications/notifications.module";
import { RealtimeGateway } from "../realtime/realtime.module";
import { MockChannelAdapter, type ChannelAdapter } from "./channel-adapter";

interface SyncJob {
  tenantId: string;
  variantId: string;
}

const QUEUE = "channel-sync";
/** Coalesce bursts (a POS checkout touching many lines, a stock count) into one push per variant. */
const DEBOUNCE_MS = 1500;

/**
 * Pushes a variant's sellable stock to every connected marketplace listing.
 *
 * Flow: inventory change → listings marked PENDING → job queued (deduplicated
 * per variant for DEBOUNCE_MS) → worker reads the *current* stock at the
 * channel's fulfilment location → adapter.pushStock → listings SYNCED/FAILED
 * → `channel.synced` emitted to the shop's open screens.
 */
@Injectable()
export class ChannelSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelSyncService.name);
  private connection!: IORedis;
  private queue!: Queue<SyncJob>;
  private worker!: Worker<SyncJob>;
  private readonly adapter: ChannelAdapter = new MockChannelAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // BullMQ requires maxRetriesPerRequest: null on its blocking connection.
    this.connection = new IORedis(this.config.get("REDIS_URL") ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
    this.connection.on("error", (e) => this.logger.warn(`Redis: ${e.message}`));
    this.queue = new Queue<SyncJob>(QUEUE, { connection: this.connection });
    this.worker = new Worker<SyncJob>(QUEUE, (job) => this.process(job), { connection: this.connection, concurrency: 5 });
    this.worker.on("failed", (job, err) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) this.markFailed(job.data, err.message).catch(() => undefined);
    });
    void this.recoverPending();
  }

  /**
   * Listings left PENDING (Redis was down when the change happened, or the
   * process stopped mid-job) are re-queued on startup so they cannot stay
   * "đang đồng bộ" forever.
   */
  private async recoverPending() {
    try {
      const stuck = await this.prisma.channelListing.findMany({
        where: { syncStatus: "PENDING" },
        select: { variantId: true, channel: { select: { tenantId: true } } },
        distinct: ["variantId"],
      });
      const byTenant = new Map<string, string[]>();
      for (const s of stuck) byTenant.set(s.channel.tenantId, [...(byTenant.get(s.channel.tenantId) ?? []), s.variantId]);
      for (const [tenantId, variantIds] of byTenant) await this.schedule(tenantId, variantIds);
      if (stuck.length) this.logger.log(`Re-queued channel sync for ${stuck.length} pending variant(s)`);
    } catch (e) {
      this.logger.warn(`Pending sync recovery skipped: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  /** Called after a stock change has been committed. Never throws: a queue outage must not undo a sale. */
  async schedule(tenantId: string, variantIds: string[]) {
    for (const variantId of new Set(variantIds)) {
      try {
        const pending = await this.prisma.channelListing.updateManyAndReturn({
          where: { variantId, channel: { tenantId, status: "CONNECTED" } },
          data: { syncStatus: "PENDING" },
          include: { channel: { select: { type: true } } },
        });
        if (!pending.length) continue;
        this.emit(tenantId, variantId, pending);
        await this.queue.add(
          "push-stock",
          { tenantId, variantId },
          {
            delay: DEBOUNCE_MS,
            deduplication: { id: `${tenantId}__${variantId}`, ttl: DEBOUNCE_MS },
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 200,
          },
        );
      } catch (e) {
        this.logger.error(`Could not schedule channel sync for ${variantId}: ${(e as Error).message}`);
      }
    }
  }

  private async process(job: Job<SyncJob>) {
    const { tenantId, variantId } = job.data;
    const listings = await this.prisma.channelListing.findMany({
      where: { variantId, channel: { tenantId, status: "CONNECTED" } },
      include: { channel: true },
    });
    const levels = await this.prisma.inventoryLevel.findMany({ where: { variantId } });

    for (const listing of listings) {
      const { channel } = listing;
      // Each channel sells from its fulfilment location; without one, offer the total.
      const rows = channel.defaultLocationId ? levels.filter((l) => l.locationId === channel.defaultLocationId) : levels;
      const quantity = Math.max(0, rows.reduce((s, l) => s + l.onHand - l.reserved, 0));
      await this.adapter.pushStock({ channelType: channel.type, externalId: listing.externalId, quantity, credentials: channel.credentials });
    }

    const updated = await this.prisma.channelListing.updateManyAndReturn({
      where: { id: { in: listings.map((l) => l.id) } },
      data: { syncStatus: "SYNCED", lastSyncedAt: new Date(), lastError: null },
      include: { channel: { select: { type: true } } },
    });
    await this.prisma.channel.updateMany({ where: { id: { in: listings.map((l) => l.channelId) } }, data: { lastSyncedAt: new Date() } });
    this.emit(tenantId, variantId, updated);
  }

  private async markFailed({ tenantId, variantId }: SyncJob, message: string) {
    const failed = await this.prisma.channelListing.updateManyAndReturn({
      where: { variantId, syncStatus: "PENDING", channel: { tenantId } },
      data: { syncStatus: "FAILED", lastError: message.slice(0, 500) },
      include: { channel: { select: { type: true, name: true } }, variant: { select: { name: true, productId: true, product: { select: { name: true } } } } },
    });
    this.emit(tenantId, variantId, failed);
    if (failed.length) {
      const v = failed[0].variant;
      await this.notifications.notify(tenantId, "channel:manage", {
        type: "sync.failed",
        title: `Không đồng bộ được tồn kho: ${v.product.name}, ${v.name}`,
        body: `${failed.map((f) => f.channel.name).join(", ")}: ${message}`,
        href: `/app/products/${v.productId}`,
        dedupeKey: variantId,
        dedupeHours: 6,
      });
    }
  }

  private emit(
    tenantId: string,
    variantId: string,
    rows: { syncStatus: ChannelListingState["syncStatus"]; lastSyncedAt: Date | null; lastError: string | null; channel: { type: ChannelListingState["channelType"] } }[],
  ) {
    const event: ChannelSyncedEvent = {
      variantId,
      listings: rows.map((r) => ({ channelType: r.channel.type, syncStatus: r.syncStatus, lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null, lastError: r.lastError })),
    };
    this.realtime.emitToTenant(tenantId, "channel.synced", event);
  }
}
