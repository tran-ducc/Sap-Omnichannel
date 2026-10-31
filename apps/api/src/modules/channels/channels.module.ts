import { Controller, Get, Global, Module } from "@nestjs/common";
import type { ChannelSummary } from "@omni/shared";
import { CurrentUser } from "../../common/auth.guard";
import type { AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { ChannelSyncService } from "./channel-sync.service";

@Controller("channels")
class ChannelsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Credentials are never selected, let alone returned. */
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ChannelSummary[]> {
    return this.prisma.channel.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, type: true, name: true, status: true, defaultLocationId: true },
      orderBy: { createdAt: "asc" },
    });
  }
}

@Global()
@Module({
  controllers: [ChannelsController],
  providers: [ChannelSyncService],
  exports: [ChannelSyncService],
})
export class ChannelsModule {}
