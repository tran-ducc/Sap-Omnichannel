import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export const ADJUST_MODES = ["add", "remove", "set"] as const;
export const ADJUST_REASONS = ["PURCHASE", "COUNT", "DAMAGE", "RETURN", "OTHER"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export class AdjustStockDto {
  @IsString()
  variantId: string;

  @IsString()
  locationId: string;

  /** add/remove apply a delta; set records a stock count. */
  @IsIn(ADJUST_MODES, { message: "Cách điều chỉnh không hợp lệ" })
  mode: (typeof ADJUST_MODES)[number];

  @Type(() => Number)
  @IsInt({ message: "Số lượng phải là số nguyên" })
  @Min(0, { message: "Số lượng không được âm" })
  @Max(1_000_000, { message: "Số lượng quá lớn" })
  quantity: number;

  @IsIn(ADJUST_REASONS, { message: "Lý do không hợp lệ" })
  reason: AdjustReason;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "Ghi chú tối đa 300 ký tự" })
  note?: string;
}

export class TransferStockDto {
  @IsString()
  variantId: string;

  @IsString()
  fromLocationId: string;

  @IsString()
  toLocationId: string;

  @Type(() => Number)
  @IsInt({ message: "Số lượng phải là số nguyên" })
  @Min(1, { message: "Số lượng chuyển ít nhất là 1" })
  @Max(1_000_000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "Ghi chú tối đa 300 ký tự" })
  note?: string;
}

const toBool = ({ value }: { value: unknown }) => value === true || value === "true" || value === "1";

export class InventoryQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
