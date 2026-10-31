import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { InventoryModule } from "../inventory/inventory.module";
import { CheckoutDto, CloseShiftDto, OpenShiftDto, PosProductQuery } from "./pos.dto";
import { PosService } from "./pos.service";

@Controller("pos")
@RequirePermission("pos:sell")
class PosController {
  constructor(private readonly pos: PosService) {}

  /** The caller's open shift, or null. */
  @Get("shifts/current")
  current(@CurrentUser() user: AuthUser) {
    return this.pos.current(user);
  }

  @Post("shifts")
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto) {
    return this.pos.open(user, dto);
  }

  @Post("shifts/:id/close")
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CloseShiftDto) {
    return this.pos.close(user, id, dto);
  }

  @Get("products")
  products(@CurrentUser() user: AuthUser, @Query() query: PosProductQuery) {
    return this.pos.products(user, query);
  }

  @Post("checkout")
  @HttpCode(200)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.pos.checkout(user, dto);
  }

  @Get("receipts/:orderId")
  receipt(@CurrentUser() user: AuthUser, @Param("orderId") orderId: string) {
    return this.pos.receipt(user, orderId);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
