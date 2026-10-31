import { Body, Controller, ForbiddenException, Get, Module, Param, Patch, Post, Query } from "@nestjs/common";
import { can, type Assignee } from "@omni/shared";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MarketplaceSimulator } from "./marketplace-simulator";
import { AssignDto, CreateOrderDto, OrderQuery, SimulateDto, UpdateStatusDto } from "./orders.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly simulator: MarketplaceSimulator,
  ) {}

  @Get()
  @RequirePermission("order:read_assigned")
  list(@CurrentUser() user: AuthUser, @Query() query: OrderQuery) {
    return this.orders.list(user, query);
  }

  @Get(":id")
  @RequirePermission("order:read_assigned")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orders.get(user, id);
  }

  @Post()
  @RequirePermission("order:create")
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    const { orderId } = await this.orders.create(user, user.tenantId, dto);
    return this.orders.get(user, orderId);
  }

  /** Demo/dev only: an incoming marketplace order through the real ingestion path. */
  @Post("simulate")
  @RequirePermission("channel:manage")
  async simulate(@CurrentUser() user: AuthUser, @Body() dto: SimulateDto) {
    if (process.env.MOCK_CHANNELS === "false") throw new ForbiddenException("Giả lập đơn đã tắt trên môi trường này");
    const { orderId } = await this.simulator.simulate(user.tenantId, dto.channelType);
    return this.orders.get(user, orderId);
  }

  /** Permission depends on the target status; checked in the service. */
  @Patch(":id/status")
  updateStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.updateStatus(user, id, dto);
  }

  @Patch(":id/assign")
  @RequirePermission("order:update")
  assign(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AssignDto) {
    return this.orders.assign(user, id, dto.userId);
  }
}

@Controller()
class OrderLookupController {
  constructor(private readonly prisma: PrismaService) {}

  /** People an order can be assigned to. */
  @Get("staff/assignees")
  async assignees(@CurrentUser() user: AuthUser): Promise<Assignee[]> {
    if (!can(user.role, "order:create")) throw new ForbiddenException("Vai trò của bạn không có quyền xem danh sách này");
    const members = await this.prisma.membership.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE", user: { isActive: true } },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, role: { select: { name: true } } },
      orderBy: { user: { fullName: "asc" } },
    });
    return members.map((m) => ({ id: m.user.id, fullName: m.user.fullName, avatarUrl: m.user.avatarUrl, role: m.role.name }));
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController, OrderLookupController],
  providers: [OrdersService, MarketplaceSimulator],
})
export class OrdersModule {}
