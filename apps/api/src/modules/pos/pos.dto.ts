import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class OpenShiftDto {
  @IsString()
  locationId: string;

  @Type(() => Number)
  @IsNumber({}, { message: "Tiền đầu ca phải là số" })
  @Min(0, { message: "Tiền đầu ca không được âm" })
  @Max(1_000_000_000)
  openingCash: number;
}

export class CloseShiftDto {
  @Type(() => Number)
  @IsNumber({}, { message: "Tiền đếm được phải là số" })
  @Min(0, { message: "Tiền đếm được không được âm" })
  @Max(10_000_000_000)
  countedCash: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

class CartLineDto {
  @IsString()
  variantId: string;

  @Type(() => Number)
  @IsInt({ message: "Số lượng phải là số nguyên" })
  @Min(1)
  @Max(1000)
  quantity: number;
}

class WalkInCustomerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Tên khách cần ít nhất 2 ký tự" })
  @MaxLength(80)
  fullName: string;

  @Transform(trim)
  @Matches(/^(0|\+84)\d{9,10}$/, { message: "Số điện thoại khách không hợp lệ" })
  phone: string;
}

export class CheckoutDto {
  @IsString()
  sessionId: string;

  /** Generated once per cart by the client; a retried submit returns the same order. */
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  clientRef: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Giỏ hàng đang trống" })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  items: CartLineDto[];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @Type(() => WalkInCustomerDto)
  @ValidateNested()
  customer?: WalkInCustomerDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "Giảm giá không được âm" })
  discount?: number;

  @IsIn(["CASH", "BANK_TRANSFER", "CARD"], { message: "Cách thanh toán không hợp lệ" })
  method: "CASH" | "BANK_TRANSFER" | "CARD";

  /** Cash handed over (cash payments only). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  received?: number;
}

export class PosProductQuery {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
