import { Controller, Get, Module, Query } from "@nestjs/common";
import { DASHBOARD_RANGES, type DashboardRange, type ReportGroupBy } from "@omni/shared";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { CurrentUser } from "../../common/auth.guard";
import { RequirePermission, type AuthUser } from "../../common/permissions.guard";
import { ReportsService } from "./reports.service";
import { SalesReportService } from "./sales-report.service";

class OverviewQuery {
  @IsOptional()
  @IsIn(DASHBOARD_RANGES, { message: "Khoảng thời gian phải là today, 7d hoặc 30d" })
  range?: DashboardRange;
}

class SalesQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Ngày bắt đầu không hợp lệ" }) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Ngày kết thúc không hợp lệ" }) to?: string;
  @IsOptional() @IsIn(["day", "week", "month"]) groupBy?: ReportGroupBy;
  @IsOptional() @IsString() locationId?: string;
}

@Controller("reports")
class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly sales: SalesReportService,
  ) {}

  /** Staff also hold "report:summary"; the service narrows their scope. */
  @Get("overview")
  @RequirePermission("report:summary")
  overview(@CurrentUser() user: AuthUser, @Query() query: OverviewQuery) {
    return this.reports.overview(user, query.range);
  }

  @Get("sales")
  @RequirePermission("report:detailed")
  salesReport(@CurrentUser() user: AuthUser, @Query() query: SalesQuery) {
    return this.sales.report(user, query);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, SalesReportService],
})
export class ReportsModule {}
