import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPING", "COMPLETED", "CANCELLED", "RETURNED"] as const;
const CHANNELS = ["POS", "WEBSITE", "SHOPEE", "LAZADA", "TIKTOK_SHOP", "FACEBOOK"] as const;
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class OrderLineDto {
  @IsString()
  variantId: string;

  @Type(() => Number)
  @IsInt({ message: "Số lượng phải là số nguyên" })
  @Min(1, { message: "Số lượng ít nhất là 1" })
  @Max(10_000)
  quantity: number;

  /** Only honoured for roles allowed to change prices (or marketplace imports). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

class NewCustomerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Tên khách cần ít nhất 2 ký tự" })
  @MaxLength(80)
  fullName: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^(0|\+84)\d{9,10}$/, { message: "Số điện thoại khách không hợp lệ" })
  phone?: string;
}

class ShippingAddressDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

export class CreateOrderDto {
  @IsIn(["WEBSITE", "FACEBOOK", "SHOPEE", "LAZADA", "TIKTOK_SHOP"], { message: "Kênh bán không hợp lệ cho đơn tạo tay" })
  channelType: (typeof CHANNELS)[number];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NewCustomerDto)
  customer?: NewCustomerDto;

  @IsArray()
  @ArrayMinSize(1, { message: "Đơn cần ít nhất một sản phẩm" })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "Giảm giá không được âm" })
  discountTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "Phí giao hàng không được âm" })
  @Max(10_000_000)
  shippingFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;
}

export class UpdateStatusDto {
  @IsIn(STATUSES, { message: "Trạng thái không hợp lệ" })
  status: (typeof STATUSES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: "Lý do tối đa 300 ký tự" })
  reason?: string;
}

export class AssignDto {
  /** null = unassign */
  @IsOptional()
  @IsString()
  userId?: string | null;
}

export class SimulateDto {
  @IsOptional()
  @IsIn(["WEBSITE", "SHOPEE", "LAZADA", "TIKTOK_SHOP", "FACEBOOK"])
  channelType?: "WEBSITE" | "SHOPEE" | "LAZADA" | "TIKTOK_SHOP" | "FACEBOOK";
}

export class OrderQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsIn(["today", "7d", "30d", "all"]) range?: "today" | "7d" | "30d" | "all";
  @IsOptional() @IsIn(["me"]) assigned?: "me";

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
