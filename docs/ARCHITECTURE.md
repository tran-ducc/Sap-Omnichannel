# Kiến trúc — Omnichannel Retail (tên sản phẩm tạm: **Sạp**)

## 1. Tổng quan

Modular monolith, monorepo dùng npm workspaces:

```
omnichannel-retail/
├── apps/
│   ├── web/                    # Next.js (App Router) + TS + Tailwind v4 + shadcn/ui + Recharts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (marketing)/        # Landing page, pricing… (public, SSG)
│   │       │   ├── (auth)/             # /login, /register, /forgot-password
│   │       │   └── (app)/app/          # Dashboard sau đăng nhập (sidebar layout)
│   │       │       ├── dashboard/
│   │       │       ├── products/  inventory/
│   │       │       ├── orders/    pos/
│   │       │       ├── customers/ reports/
│   │       │       ├── staff/     settings/
│   │       │       └── activity/
│   │       ├── components/
│   │       │   ├── ui/                 # shadcn primitives (button, badge, card…)
│   │       │   ├── marketing/          # Section components của landing
│   │       │   ├── app/                # Shell, sidebar, KPI card, data table…
│   │       │   └── charts/             # Wrapper Recharts dùng chung
│   │       ├── lib/                    # api client, format (VND/ngày), utils
│   │       ├── hooks/
│   │       └── stores/                 # Zustand (giỏ hàng POS, UI state)
│   │
│   └── api/                    # NestJS + Prisma + PostgreSQL + Redis (BullMQ)
│       ├── prisma/schema.prisma
│       └── src/
│           ├── common/                 # guards (JWT, Permission), tenant context, filters, pipes
│           ├── prisma/                 # PrismaService (tenant-scoped helpers)
│           └── modules/
│               ├── auth/               # login, refresh, register-tenant
│               ├── tenants/  locations/  channels/
│               ├── products/ inventory/
│               ├── orders/   pos/
│               ├── customers/ reports/
│               ├── staff/    notifications/  activity/
│               └── integrations/       # Adapter Shopee/Lazada/TikTok/Facebook (mock trước)
│
├── packages/
│   └── shared/                 # RBAC permission map, DTO types, zod schemas dùng chung FE/BE
├── docs/
└── docker-compose.yml          # postgres + redis cho dev
```

## 2. Multi-tenant

- Mỗi shop = 1 `Tenant`. Mọi bảng nghiệp vụ có `tenantId`.
- `User` là danh tính toàn cục; vai trò trong từng shop nằm ở `Membership` (một người có thể làm cho nhiều shop).
- JWT access token (15 phút) chứa `sub`, `tenantId`, `role`. Refresh token (30 ngày) lưu hash trong DB, xoay vòng mỗi lần refresh.
- `TenantContext` (AsyncLocalStorage) gắn `tenantId` cho mỗi request; repository luôn lọc theo `tenantId` → không thể vô tình đọc chéo shop.

## 3. Phân quyền (RBAC)

Định nghĩa duy nhất trong `packages/shared/src/rbac.ts`. API kiểm tra bằng decorator `@RequirePermission('product:update_price')`; UI dùng `can(role, perm)` để ẩn menu/nút.

| Quyền | Admin | Quản lý | Nhân viên |
|---|:-:|:-:|:-:|
| Xoá shop, cài đặt hệ thống | ✓ | | |
| Cài đặt cửa hàng, chi nhánh, kênh bán | ✓ | ✓ | |
| Sản phẩm: tạo/sửa/xoá, sửa giá | ✓ | ✓ | |
| Xem sản phẩm & tồn kho | ✓ | ✓ | ✓ |
| Điều chỉnh / chuyển kho | ✓ | ✓ | |
| Xem tất cả đơn hàng, huỷ đơn | ✓ | ✓ | |
| Xem đơn được phân, tạo đơn, bán POS | ✓ | ✓ | ✓ |
| Giảm giá tại POS | ✓ | ✓ | |
| Báo cáo chi tiết | ✓ | ✓ | |
| Báo cáo tóm tắt (ca của mình) | ✓ | ✓ | ✓ |
| Quản lý nhân viên | ✓ | ✓ | |
| Nhật ký hoạt động | ✓ | ✓ | |

Nhân viên có thể bị giới hạn theo chi nhánh qua `MembershipLocation`.

## 4. Tồn kho real-time & chống bán vượt

1. Đơn đến (POS / webhook sàn) → `OrdersService.create` trong 1 transaction:
   - `UPDATE inventory_level SET reserved = reserved + n, version = version + 1 WHERE id = ? AND version = ? AND on_hand - reserved >= n`
   - 0 dòng bị ảnh hưởng → retry (tối đa 3) hoặc báo hết hàng.
   - Ghi `InventoryMovement` (sổ cái append-only).
2. Sau commit: phát event `inventory.changed` → 
   - Socket.io room `tenant:{id}` → dashboard/POS cập nhật ngay.
   - BullMQ job `channel-sync` (debounce 2s theo variant) → đẩy tồn kho mới lên các sàn qua adapter.
3. Adapter sàn hiện là mock (`integrations/mock`), cùng interface `ChannelAdapter { pullOrders, pushStock, ack }` để thay bằng API thật sau.

## 5. API REST (tóm tắt)

Tiền tố `/api/v1`. Validation bằng `class-validator` (DTO) — lỗi trả về dạng chuẩn:

```json
{ "statusCode": 422, "error": "ValidationError", "message": "Dữ liệu không hợp lệ", "details": [{ "field": "price", "message": "Giá phải lớn hơn 0" }] }
```

| Module | Endpoint chính |
|---|---|
| auth | `POST /auth/register` (tạo tenant + admin), `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `POST /products/:id/variants` |
| inventory | `GET /inventory?locationId=&lowStock=`, `POST /inventory/adjust`, `POST /inventory/transfer`, `GET /inventory/:variantId/movements` |
| orders | `GET /orders?channel=&status=&from=&to=`, `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`, `POST /orders/:id/assign` |
| pos | `POST /pos/sessions/open`, `POST /pos/sessions/:id/close`, `POST /pos/checkout` |
| customers | `GET/POST /customers`, `GET/PATCH /customers/:id`, `GET /customers/:id/orders` |
| reports | `GET /reports/overview`, `/reports/sales-by-channel`, `/reports/top-products`, `/reports/hourly-heatmap` |
| staff | `GET/POST /staff` (mời), `PATCH /staff/:id` (đổi vai trò/chi nhánh), `DELETE /staff/:id` |
| settings | `GET/PATCH /settings/store`, `GET/POST/PATCH /locations`, `GET/POST /channels`, `POST /channels/:id/sync` |
| notifications | `GET /notifications`, `POST /notifications/:id/read`, `GET /activity` |

Phân trang theo trang: `?page=1&limit=25` → `{ items, total, page, limit }`. Bảng quản trị cần hiện "1–25 trong 312" và nhảy trang, nên dùng page/offset; khi một danh sách vượt vài chục nghìn dòng (đơn hàng) sẽ chuyển sang cursor.

**Realtime (Socket.io, namespace `/realtime`)**: client gửi access token trong handshake (`auth.token`), được vào phòng `tenant:{id}`. Sự kiện: `inventory.changed` `{ variantId, level, movementType, quantity, actorName }` và `channel.synced` `{ variantId, listings[] }`.

**Vòng đời đơn hàng** (định nghĩa chung trong `packages/shared/src/order-types.ts`, API và giao diện dùng cùng một bảng):

| Từ → Đến | Ảnh hưởng tồn kho | Quyền |
|---|---|---|
| (tạo đơn) | `reserved += số lượng` (RESERVE), từ chối nếu không đủ hàng có thể bán | `order:create` |
| Chờ xác nhận → Đã xác nhận → Đóng gói | không | `order:update` |
| → Đang giao (hoặc Hoàn thành khi chưa giao) | `onHand −= sl`, `reserved −= sl` (SALE) | `order:update` |
| Đang giao → Hoàn thành | ghi nhận thanh toán COD, cập nhật tổng chi tiêu của khách | `order:update` |
| → Đã huỷ (trước khi giao) | `reserved −= sl` (RELEASE), bắt buộc có lý do | `order:cancel` |
| Đang giao / Hoàn thành → Trả hàng | `onHand += sl` (RETURN), đơn đã trả tiền chuyển "đã hoàn tiền" | `order:cancel` |

Đơn có `stockReservedAt` / `stockDeductedAt` để biết đã giữ / đã xuất kho hay chưa; đơn nhập trước khi có theo dõi tồn kho (dữ liệu cũ) không có hai mốc này nên không bị trừ hay nhả nhầm. Hai người thao tác cùng lúc trên một đơn: chỉ người đầu tiên thành công (cập nhật có điều kiện trên trạng thái hiện tại), người sau nhận 409. Mã đơn `DH-000123` lấy từ bộ đếm `Tenant.orderSeq` tăng nguyên tử.

**Đồng bộ kênh bán (BullMQ, hàng đợi `channel-sync`)**: mỗi thay đổi tồn kho đánh dấu listing `PENDING` và xếp job theo variant, gộp các thay đổi trong 1,5 giây (deduplication). Worker đọc tồn hiện tại tại kho xuất hàng của từng kênh và gọi `ChannelAdapter.pushStock`; thử lại 3 lần với backoff, sau đó đánh dấu `FAILED`. Khi API khởi động, các listing còn `PENDING` được xếp lại. Adapter hiện là mock (`MOCK_CHANNEL_FAILURE_RATE` để thử lỗi).

## 6. Design system

Một bảng màu dùng chung cho landing page và toàn bộ app. Token nằm duy nhất ở `apps/web/src/app/globals.css`; component chỉ dùng tên ngữ nghĩa (`bg-lime`, `bg-night`, `text-muted-foreground`…), không viết mã hex.

**Hai tham chiếu, một hệ màu:**
- *Landing* theo bố cục "Payarc": board lớn bo góc, đường nối mảnh có nút sao 4 cánh, card nổi (số liệu, donut tối, ảnh có quầng sáng), thẻ nhân viên có dây đeo, vé/hoá đơn có mã vạch.
- *App (dashboard, POS, đơn hàng…)* theo bố cục "OxeliaMetrix": card bo 24px có **góc khuyết** (`.notch`) chứa nút tròn, pill trắng chọn ngày, card tối cho biểu đồ, card xám sage cho số phụ, nút đen dạng pill. Khung xem thử trong landing (`product-preview.tsx`) là bản mẫu cho các màn hình thật.

**Màu (light):**
| Token | Hex | Dùng cho |
|---|---|---|
| `background` | #E4E8DF | nền trang (sage nhạt) |
| `board` | #F6F7F1 | board lớn của landing, sidebar app |
| `card` | #FFFFFF | card, pill trắng |
| `ink` / `primary` | #121410 | chữ chính, nút chính (pill đen) |
| `lime` | #E2F76A | **điểm nhấn thương hiệu duy nhất**: trạng thái đang chọn, card nổi bật, quầng sáng |
| `sage` | #949D8D | card số liệu phụ |
| `night` | #121410 | card luôn tối (biểu đồ), giữ nguyên ở cả hai theme |
| `amber` | #F2A93B | **chỉ** cho cảnh báo: tồn thấp, chờ xử lý |

**Dark mode:** nền #0D0F0C, card #1C2019. Nút chính đổi sang lime với chữ đen để giữ độ tương phản.

- **Font:** *Lexend* (300–600, có subset tiếng Việt). Tiêu đề dùng weight 400, tracking âm; số lớn dùng weight 300. Số liệu dùng `tabular-nums`.
- **Bo góc theo cấp:** board 32px, card 24px, khối bên trong 16px, nút và chip bo tròn hẳn.
- **Màu kênh bán** chỉ dùng cho chấm/nhãn kênh và luôn kèm tên kênh.
- **Ảnh:** ảnh Unsplash tạm (`components/marketing/photos.ts`), cần thay bằng ảnh thật trước khi ra mắt.
## 7. Thứ tự triển khai

1. ✅ Cấu trúc + schema + landing page
2. ✅ Auth (đăng ký shop, đăng nhập, refresh xoay vòng, đăng xuất) + app shell (sidebar theo quyền, drawer trên tablet, dark mode)
3. ✅ Dashboard tổng quan (`GET /reports/overview?range=today|7d|30d`, Staff chỉ thấy đơn của mình)
4. ✅ Sản phẩm & tồn kho (biến thể, tồn theo chi nhánh, điều chỉnh/chuyển kho với optimistic locking, sổ kho, đồng bộ kênh qua BullMQ, realtime Socket.io)
5. ✅ Đơn hàng đa kênh (giữ hàng khi đặt, xuất kho khi giao, nhả khi huỷ, nhập lại khi trả; giả lập đơn sàn qua đúng luồng nhập đơn thật)
6. ✅ POS (ca bán hàng có đối chiếu tiền mặt, tìm/quét mã vạch, giỏ hàng lưu trên máy, thanh toán tiền mặt/chuyển khoản/thẻ, tích điểm, in hoá đơn 80mm; checkout chống trùng đơn bằng `clientRef`). Chưa có: bán khi mất mạng.
7. ✅ Báo cáo (`GET /reports/sales`: so với kỳ trước, theo kênh/chi nhánh/sản phẩm/danh mục/nhân viên, heatmap giờ VN, xuất CSV), khách hàng (CRM, lịch sử mua theo kênh), nhân viên (phân cấp Admin > Quản lý > Nhân viên, mật khẩu tạm hiện một lần, khoá tài khoản), cài đặt (cửa hàng, chi nhánh/kho, kênh bán + kho xuất hàng, xoá cửa hàng cho Admin), thông báo realtime (chuông + trang), nhật ký hoạt động, đổi mật khẩu.

### Còn lại / giới hạn đã biết

- POS chưa bán được khi mất mạng (landing page đang nhắc tới tính năng này).
- Đổi vai trò hoặc khoá tài khoản có hiệu lực khi access token hết hạn (tối đa 15 phút); refresh token bị thu hồi ngay.
- Lợi nhuận gộp tính theo giá vốn hiện tại, chưa lưu giá vốn tại thời điểm bán.
- Adapter sàn vẫn là mock.
