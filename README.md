# Sạp — Omnichannel Retail

Quản lý bán hàng đa kênh (quầy, website, Shopee, Lazada, TikTok Shop, Facebook) trên một nền tảng.
Kiến trúc, schema và design system: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Chạy ở máy local

Yêu cầu: Node 22+, Docker.

```bash
npm install                                   # cài cho cả monorepo (npm workspaces)
docker compose up -d                          # Postgres 16 + Redis 7
cp apps/api/.env.example apps/api/.env        # rồi đổi các secret
npm run build -w @omni/shared                 # gói dùng chung, build ra CommonJS
npm run prisma:migrate -w @omni/api           # tạo bảng
npm run db:seed -w @omni/api                  # cửa hàng mẫu "Linen House"
npm run dev:api                               # http://localhost:4000/api/v1
npm run dev:web                               # http://localhost:3000
```

`apps/web/.env.local` cần `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`.

### Tài khoản mẫu (chỉ môi trường phát triển)

Seed tạo một tài khoản cho mỗi vai trò, dùng chung mật khẩu `DEMO_PASSWORD` trong [apps/api/prisma/seed.ts](apps/api/prisma/seed.ts):

| Vai trò | Email |
|---|---|
| Admin | admin@linenhouse.test |
| Quản lý | manager@linenhouse.test |
| Nhân viên | staff@linenhouse.test |

Khi `NEXT_PUBLIC_DEMO_PASSWORD` có trong `apps/web/.env.local`, trang `/login` hiện nút đăng nhập nhanh cho ba vai trò này.

Cửa hàng thử tạo qua `/register` khi kiểm thử: `owner@nhamay.test` / `Nhamay2026x` (“Tiệm Gốm Nhà Mây”, không có dữ liệu).

## Ghi chú

- Ảnh trên landing là ảnh Unsplash tạm (`apps/web/src/components/marketing/photos.ts`); tên, lời nhận xét và số liệu là minh hoạ.
- Gọi `tsc`/`eslint` qua `node_modules/.bin` ở thư mục gốc; `npx` trong workspace có thể không tìm thấy bản cục bộ.
