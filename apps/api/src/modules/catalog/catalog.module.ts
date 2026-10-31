import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from "@nestjs/common";
import type { CategorySummary, LocationSummary } from "@omni/shared";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CreateProductDto, ProductQuery, UpdateProductDto, UpdateVariantDto } from "./catalog.dto";
import { ProductsService } from "./products.service";

@Controller("products")
class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission("product:read")
  list(@CurrentUser() user: AuthUser, @Query() query: ProductQuery) {
    return this.products.list(user, query);
  }

  @Get(":id")
  @RequirePermission("product:read")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.products.get(user, id);
  }

  @Post()
  @RequirePermission("product:create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Patch(":id")
  @RequirePermission("product:update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(user, id, dto);
  }

  @Patch("variants/:variantId")
  @RequirePermission("product:update")
  updateVariant(@CurrentUser() user: AuthUser, @Param("variantId") variantId: string, @Body() dto: UpdateVariantDto) {
    return this.products.updateVariant(user, variantId, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("product:delete")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.products.archive(user, id);
  }
}

@Controller()
class LookupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("locations")
  locations(@CurrentUser() user: AuthUser): Promise<LocationSummary[]> {
    return this.prisma.location.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, code: true, type: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    });
  }

  @Get("categories")
  categories(@CurrentUser() user: AuthUser): Promise<CategorySummary[]> {
    return this.prisma.category.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [ProductsController, LookupController],
  providers: [ProductsService],
})
export class CatalogModule {}
