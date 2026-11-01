import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { ApiError } from "@omni/shared";
import type { Response } from "express";

/**
 * Normalises every error into the shared ApiError shape so the web client
 * has one thing to handle. Unknown errors are logged and hidden.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      const body: ApiError = { statusCode: 500, error: "InternalError", message: "Đã có lỗi hệ thống. Vui lòng thử lại." };
      return res.status(500).json(body);
    }

    const status = exception.getStatus();
    const raw = exception.getResponse() as string | { message?: string | string[]; error?: string; details?: ApiError["details"]; shops?: ApiError["shops"] };
    const message = typeof raw === "string" ? raw : Array.isArray(raw.message) ? raw.message[0] : (raw.message ?? exception.message);
    const body: ApiError = {
      statusCode: status,
      error: typeof raw === "object" && raw.details ? "ValidationError" : typeof raw === "object" && raw.shops ? "ShopSelectionRequired" : exception.name.replace(/Exception$/, ""),
      message,
      ...(typeof raw === "object" && raw.details ? { details: raw.details } : {}),
      ...(typeof raw === "object" && raw.shops ? { shops: raw.shops } : {}),
    };
    return res.status(status).json(body);
  }
}
