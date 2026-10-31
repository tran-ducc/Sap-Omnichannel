import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const CHANNEL_TYPES = ["WEBSITE", "SHOPEE", "LAZADA", "TIKTOK_SHOP", "FACEBOOK"] as const;
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class OptionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Tên thuộc tính không được trống" })
  @MaxLength(30)
  name: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Mỗi thuộc tính cần ít nhất 1 giá trị" })
  @ArrayMaxSize(30, { message: "Tối đa 30 giá trị cho mỗi thuộc tính" })
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  values: string[];
}

class StockInputDto {
  @IsString()
  locationId: string;

  @Type(() => Number)
  @IsInt({ message: "Số lượng tồn phải là số nguyên" })
  @Min(0, { message: "Số lượng tồn không được âm" })
  @Max(1_000_000)
  quantity: number;
}

class VariantInputDto {
  @IsObject()
  attributes: Record<string, string>;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9._-]{1,64}$/, { message: "SKU chỉ gồm chữ, số, dấu chấm, gạch ngang (tối đa 64 ký tự)" })
  sku: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{6,14}$/, { message: "Mã vạch gồm 6 đến 14 chữ số" })
  barcode?: string;

  @Type(() => Number)
  @IsNumber({}, { message: "Giá bán phải là số" })
  @Min(0, { message: "Giá bán không được âm" })
  @Max(10_000_000_000)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Giá vốn phải là số" })
  @Min(0, { message: "Giá vốn không được âm" })
  costPrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockInputDto)
  initialStock?: StockInputDto[];
}

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Tên sản phẩm cần ít nhất 2 ký tự" })
  @MaxLength(150, { message: "Tên sản phẩm tối đa 150 ký tự" })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsArray()
  @ArrayMaxSize(3, { message: "Tối đa 3 thuộc tính (ví dụ Màu, Size, Chất liệu)" })
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options: OptionDto[];

  @IsArray()
  @ArrayMinSize(1, { message: "Cần ít nhất một mẫu sản phẩm" })
  @ArrayMaxSize(100, { message: "Tối đa 100 mẫu cho một sản phẩm" })
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];

  /** Online channels to list the new variants on. */
  @IsOptional()
  @IsArray()
  @IsIn(CHANNEL_TYPES, { each: true })
  channelTypes?: (typeof CHANNEL_TYPES)[number][];
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Tên sản phẩm cần ít nhất 2 ký tự" })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE"], { message: "Trạng thái không hợp lệ" })
  status?: "DRAFT" | "ACTIVE";
}

export class UpdateVariantDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Giá bán phải là số" })
  @Min(0, { message: "Giá bán không được âm" })
  @Max(10_000_000_000)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Giá vốn phải là số" })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{6,14}$/, { message: "Mã vạch gồm 6 đến 14 chữ số" })
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  reorderPoint?: number;

  /** Required with reorderPoint: which location's threshold to change. */
  @IsOptional()
  @IsString()
  locationId?: string;
}

export class ProductQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(["DRAFT", "ACTIVE", "ARCHIVED"])
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";

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
  limit = 20;
}
