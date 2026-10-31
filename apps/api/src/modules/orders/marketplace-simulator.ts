import { BadRequestException, Injectable } from "@nestjs/common";
import type { ChannelType } from "@omni/shared";
import { PrismaService } from "../../prisma/prisma.module";
import { OrdersService } from "./orders.service";

const FIRST = ["Anh", "Châu", "Bảo", "Tâm", "Yến", "Hân", "Linh", "Khoa", "Vy", "Quân", "My", "Thảo"];
const LAST = ["Nguyễn", "Lê", "Phạm", "Võ", "Đặng", "Trần", "Bùi", "Hồ"];
const STREETS = ["12 Lý Tự Trọng, Quận 1, TP.HCM", "45 Nguyễn Trãi, Thanh Xuân, Hà Nội", "8 Trần Phú, Hải Châu, Đà Nẵng", "102 Hùng Vương, Ninh Kiều, Cần Thơ"];
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Stand-in for marketplace webhooks while real integrations are not
 * connected. It builds an order the way a Shopee/TikTok push would and sends
 * it through the same OrdersService.create path real webhooks will use.
 */
@Injectable()
export class MarketplaceSimulator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async simulate(tenantId: string, requested?: Exclude<ChannelType, "POS">) {
    const channels = await this.prisma.channel.findMany({ where: { tenantId, status: "CONNECTED", type: requested ?? { not: "POS" } } });
    if (!channels.length) throw new BadRequestException("Chưa có kênh online nào được kết nối");
    const channel = pick(channels);
    if (!channel.defaultLocationId) throw new BadRequestException("Kênh chưa có kho xuất hàng");

    // Only offer what the channel can actually fulfil right now.
    const levels = await this.prisma.inventoryLevel.findMany({
      where: { tenantId, locationId: channel.defaultLocationId, onHand: { gt: 0 }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } },
      select: { variantId: true, onHand: true, reserved: true },
    });
    const sellable = levels.filter((l) => l.onHand - l.reserved >= 2);
    if (!sellable.length) throw new BadRequestException("Kho của kênh này đã hết hàng để giả lập đơn");

    const lines = [...sellable].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
    const existing = Math.random() < 0.6 ? await this.prisma.customer.findFirst({ where: { tenantId }, skip: Math.floor(Math.random() * 30) }) : null;
    const name = existing?.fullName ?? `${pick(LAST)} ${pick(FIRST)}`;
    const phone = existing?.phone ?? `09${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    return this.orders.create(
      null,
      tenantId,
      {
        channelType: channel.type,
        ...(existing ? { customerId: existing.id } : { customer: { fullName: name, phone } }),
        items: lines.map((l) => ({ variantId: l.variantId, quantity: 1 })),
        shippingFee: Math.random() < 0.5 ? 0 : 25_000,
        shippingAddress: { name, phone, address: pick(STREETS) },
        // Marketplaces collect payment up front most of the time; the rest is COD.
        paid: channel.type !== "FACEBOOK" && Math.random() < 0.7,
      },
      { kind: "marketplace", externalOrderId: `${channel.type.slice(0, 2)}${Date.now().toString().slice(-9)}` },
    );
  }
}
