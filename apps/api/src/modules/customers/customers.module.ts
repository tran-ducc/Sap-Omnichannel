import { Body, Controller, Get, Module, NotFoundException, Param, Patch, Post, Query, ConflictException, Injectable } from "@nestjs/common";
import type { ChannelType, CustomerDetail, CustomerListItem, CustomerLite, Page } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));

class LookupQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

class CustomerQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
  @IsOptional() @IsIn(["spent", "recent", "orders", "name", "new"]) sort?: "spent" | "recent" | "orders" | "name" | "new";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

class CustomerInput {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2, { message: "Tên khách cần ít nhất 2 ký tự" }) @MaxLength(80) fullName?: string;
  @IsOptional() @Transform(trim) @Matches(/^(0|\+84)\d{9,10}$/, { message: "Số điện thoại không hợp lệ" }) phone?: string;
  @IsOptional() @Transform(({ value }) => (value === "" ? undefined : typeof value === "string" ? value.trim().toLowerCase() : value)) @IsEmail({}, { message: "Email không đúng định dạng" }) email?: string;
  @IsOptional() @IsIn(["Nữ", "Nam", "Khác"], { message: "Giới tính không hợp lệ" }) gender?: string;
  @IsOptional() @IsISO8601({}, { message: "Ngày sinh không hợp lệ" }) birthday?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

class CreateCustomerDto extends CustomerInput {
  @Transform(trim) @IsString() @MinLength(2, { message: "Tên khách cần ít nhất 2 ký tự" }) @MaxLength(80) declare fullName: string;
}

const toItem = (c: { id: string; fullName: string; phone: string | null; email: string | null; tags: string[]; loyaltyPoints: number; orderCount: number; totalSpent: Prisma.Decimal; lastOrderAt: Date | null; createdAt: Date }): CustomerListItem => ({
  id: c.id,
  fullName: c.fullName,
  phone: c.phone,
  email: c.email,
  tags: c.tags,
  loyaltyPoints: c.loyaltyPoints,
  orderCount: c.orderCount,
  totalSpent: num(c.totalSpent),
  lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
});

@Injectable()
class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  lookup(user: AuthUser, q?: string): Promise<CustomerLite[]> {
    const search = q?.trim();
    return this.prisma.customer.findMany({
      where: { tenantId: user.tenantId, ...(search && { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] }) },
      select: { id: true, fullName: true, phone: true, orderCount: true },
      orderBy: [{ orderCount: "desc" }, { fullName: "asc" }],
      take: 10,
    });
  }

  async list(user: AuthUser, q: CustomerQuery): Promise<Page<CustomerListItem>> {
    const search = q.q?.trim();
    const where: Prisma.CustomerWhereInput = {
      tenantId: user.tenantId,
      ...(q.tag && { tags: { has: q.tag } }),
      ...(search && {
        OR: [{ fullName: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }, { email: { contains: search, mode: "insensitive" } }],
      }),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
      q.sort === "recent"
        ? [{ lastOrderAt: { sort: "desc", nulls: "last" } }]
        : q.sort === "orders"
          ? [{ orderCount: "desc" }]
          : q.sort === "name"
            ? [{ fullName: "asc" }]
            : q.sort === "new"
              ? [{ createdAt: "desc" }]
              : [{ totalSpent: "desc" }];
    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, orderBy: [...orderBy, { id: "asc" }], skip: (q.page - 1) * q.limit, take: q.limit }),
    ]);
    return { total, page: q.page, limit: q.limit, items: rows.map(toItem) };
  }

  async get(user: AuthUser, id: string): Promise<CustomerDetail> {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!c) throw new NotFoundException("Không tìm thấy khách hàng");
    const [orders, byChannel] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        orderBy: { placedAt: "desc" },
        take: 20,
        select: { id: true, code: true, channelType: true, status: true, total: true, placedAt: true },
      }),
      this.prisma.order.groupBy({ by: ["channelType"], where: { customerId: id, status: { notIn: ["CANCELLED", "RETURNED"] } }, _count: { _all: true }, _sum: { total: true } }),
    ]);
    return {
      ...toItem(c),
      gender: c.gender,
      birthday: c.birthday?.toISOString().slice(0, 10) ?? null,
      address: c.address,
      note: c.note,
      averageOrder: c.orderCount ? num(c.totalSpent) / c.orderCount : 0,
      channels: byChannel.map((r) => ({ channel: r.channelType as ChannelType, orders: r._count._all, revenue: num(r._sum.total) })).sort((a, b) => b.revenue - a.revenue),
      orders: orders.map((o) => ({ id: o.id, code: o.code, channelType: o.channelType, status: o.status, total: num(o.total), placedAt: o.placedAt.toISOString() })),
    };
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    try {
      const c = await this.prisma.customer.create({
        data: { tenantId: user.tenantId, ...dto, birthday: dto.birthday ? new Date(dto.birthday) : undefined, tags: dto.tags ?? [] },
      });
      return this.get(user, c.id);
    } catch (e) {
      throw this.dupe(e);
    }
  }

  async update(user: AuthUser, id: string, dto: CustomerInput) {
    if (!(await this.prisma.customer.count({ where: { id, tenantId: user.tenantId } }))) throw new NotFoundException("Không tìm thấy khách hàng");
    try {
      await this.prisma.customer.update({ where: { id }, data: { ...dto, birthday: dto.birthday ? new Date(dto.birthday) : dto.birthday === "" ? null : undefined } });
    } catch (e) {
      throw this.dupe(e);
    }
    await this.prisma.activityLog.create({
      data: { tenantId: user.tenantId, actorId: user.userId, action: "customer.updated", entityType: "Customer", entityId: id, metadata: { fields: Object.keys(dto) } },
    });
    return this.get(user, id);
  }

  private dupe(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? new ConflictException("Số điện thoại này đã thuộc về một khách hàng khác") : e;
  }
}

@Controller("customers")
class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Small result set for pickers (order form, POS). */
  @Get("lookup")
  @RequirePermission("customer:read")
  lookup(@CurrentUser() user: AuthUser, @Query() { q }: LookupQuery) {
    return this.customers.lookup(user, q);
  }

  @Get()
  @RequirePermission("customer:read")
  list(@CurrentUser() user: AuthUser, @Query() query: CustomerQuery) {
    return this.customers.list(user, query);
  }

  @Get(":id")
  @RequirePermission("customer:read")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.customers.get(user, id);
  }

  @Post()
  @RequirePermission("customer:manage")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user, dto);
  }

  @Patch(":id")
  @RequirePermission("customer:manage")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CustomerInput) {
    return this.customers.update(user, id, dto);
  }
}

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
