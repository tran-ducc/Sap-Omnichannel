import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Tên cửa hàng cần ít nhất 2 ký tự" })
  @MaxLength(80, { message: "Tên cửa hàng tối đa 80 ký tự" })
  shopName: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Họ tên cần ít nhất 2 ký tự" })
  @MaxLength(80)
  fullName: string;

  @Transform(lower)
  @IsEmail({}, { message: "Email không đúng định dạng" })
  email: string;

  // Decorators register bottom-up and the first message wins, so the length rule sits last.
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: "Mật khẩu cần có cả chữ và số" })
  @MaxLength(72, { message: "Mật khẩu tối đa 72 ký tự" }) // bcrypt limit
  @MinLength(8, { message: "Mật khẩu cần ít nhất 8 ký tự" })
  @IsString()
  password: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^(0|\+84)\d{9,10}$/, { message: "Số điện thoại không hợp lệ" })
  phone?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu hiện tại" })
  currentPassword: string;

  // Decorators register bottom-up and the first message wins, so the length rule sits last.
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: "Mật khẩu mới cần có cả chữ và số" })
  @MaxLength(72, { message: "Mật khẩu tối đa 72 ký tự" })
  @MinLength(8, { message: "Mật khẩu mới cần ít nhất 8 ký tự" })
  @IsString()
  newPassword: string;
}

export class LoginDto {
  @Transform(lower)
  @IsEmail({}, { message: "Email không đúng định dạng" })
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu" })
  password: string;

  /** Optional when the user belongs to several shops. */
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
