import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { AdjustStockDto, InventoryQuery, TransferStockDto } from "./inventory.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission("inventory:read")
  list(@CurrentUser() user: AuthUser, @Query() query: InventoryQuery) {
    return this.inventory.list(user, query);
  }

  @Post("adjust")
  @HttpCode(200)
  @RequirePermission("inventory:adjust")
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(user, dto);
  }

  @Post("transfer")
  @HttpCode(200)
  @RequirePermission("inventory:transfer")
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferStockDto) {
    return this.inventory.transfer(user, dto);
  }

  @Get(":variantId/movements")
  @RequirePermission("inventory:read")
  movements(@CurrentUser() user: AuthUser, @Param("variantId") variantId: string) {
    return this.inventory.movements(user, variantId);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
