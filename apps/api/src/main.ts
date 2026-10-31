import "reflect-metadata";
import { UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { ValidationError } from "class-validator";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

/** Flattens class-validator errors into [{ field, message }] (first message per field). */
function toDetails(errors: ValidationError[], parent = ""): { field: string; message: string }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, message: Object.values(e.constraints)[0] }] : [];
    return [...own, ...toDetails(e.children ?? [], field)];
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new UnprocessableEntityException({ message: "Dữ liệu không hợp lệ", details: toDetails(errors) }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(Number(process.env.PORT ?? 4000));
}

bootstrap();
