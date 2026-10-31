import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard, Public } from "./common/auth.guard";
import { PermissionsGuard } from "./common/permissions.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { StaffModule } from "./modules/staff/staff.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PosModule } from "./modules/pos/pos.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { PrismaModule } from "./prisma/prisma.module";

@Controller("health")
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok", time: new Date().toISOString() };
  }
}

// Feature modules are registered here as they are built — see docs/ARCHITECTURE.md §7.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: config.get("JWT_ACCESS_TTL") ?? "15m" },
      }),
    }),
    PrismaModule,
    RealtimeModule,
    NotificationsModule,
    ChannelsModule,
    AuthModule,
    ReportsModule,
    InventoryModule,
    CatalogModule,
    OrdersModule,
    PosModule,
    CustomersModule,
    StaffModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check permissions.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
