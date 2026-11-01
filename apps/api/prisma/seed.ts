/**
 * Demo data: one shop ("Linen House") with an account for each role, products,
 * stock across three locations, customers and ~65 days of multi-channel orders.
 *
 *   npm run db:seed -w @omni/api
 *
 * Demo logins (local development only — all share DEMO_PASSWORD below):
 *   admin@linenhouse.test    Admin
 *   manager@linenhouse.test  Quản lý
 *   staff@linenhouse.test    Nhân viên
 *
 * Re-running wipes and recreates the demo shop. Random values come from a
 * seeded PRNG so every run produces the same shop.
 */
import { ROLE_KEYS, ROLE_PERMISSIONS, type RoleKey } from "@omni/shared";
import { ChannelType, OrderStatus, PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "Sapdemo2026";
const SLUG = "linen-house";
const DAYS = 65;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261030);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) if ((r -= w) <= 0) return v;
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
const SIZES = ["S", "M", "L"];
const CATALOG: { name: string; category: string; price: number; cost: number; colors: string[]; sizes?: string[]; sku: string }[] = [
  { name: "Áo linen cổ tàu", category: "Áo", price: 385_000, cost: 160_000, colors: ["Be", "Trắng", "Xanh rêu"], sku: "LN-CT" },
  { name: "Áo sơ mi tay lỡ", category: "Áo", price: 345_000, cost: 140_000, colors: ["Trắng", "Xanh nhạt"], sku: "SM-TL" },
  { name: "Áo thun cotton basic", category: "Áo", price: 199_000, cost: 70_000, colors: ["Đen", "Trắng", "Be"], sku: "TC-BS" },
  { name: "Quần ống suông đũi", category: "Quần", price: 420_000, cost: 175_000, colors: ["Đen", "Be"], sku: "QD-OS" },
  { name: "Quần short linen", category: "Quần", price: 290_000, cost: 110_000, colors: ["Be", "Nâu"], sku: "QS-LN" },
  { name: "Đầm suông cổ vuông", category: "Đầm, váy", price: 560_000, cost: 230_000, colors: ["Đen", "Hồng đất"], sku: "DS-CV" },
  { name: "Chân váy xếp ly", category: "Đầm, váy", price: 395_000, cost: 150_000, colors: ["Be", "Đen"], sku: "CV-XL" },
  { name: "Túi cói quai da", category: "Phụ kiện", price: 290_000, cost: 120_000, colors: ["Tự nhiên"], sizes: ["One size"], sku: "TC-QD" },
  { name: "Khăn lụa vuông", category: "Phụ kiện", price: 180_000, cost: 60_000, colors: ["Hoạ tiết sen", "Hoạ tiết lá"], sizes: ["One size"], sku: "KL-VG" },
  { name: "Mũ bucket linen", category: "Phụ kiện", price: 160_000, cost: 55_000, colors: ["Be", "Đen"], sizes: ["One size"], sku: "MB-LN" },
  { name: "Áo khoác kimono", category: "Áo", price: 490_000, cost: 210_000, colors: ["Be"], sku: "AK-KM" },
  { name: "Set bộ linen mặc nhà", category: "Đầm, váy", price: 650_000, cost: 270_000, colors: ["Be", "Xanh rêu"], sku: "SB-LN" },
];
// Bestsellers sell more often
const POPULARITY = [10, 5, 8, 9, 4, 7, 5, 6, 4, 3, 2, 3];

const CHANNEL_MIX: readonly (readonly [ChannelType, number])[] = [
  ["POS", 25],
  ["SHOPEE", 30],
  ["TIKTOK_SHOP", 25],
  ["LAZADA", 10],
  ["FACEBOOK", 6],
  ["WEBSITE", 4],
];
const CHANNEL_NAMES: Record<ChannelType, string> = {
  POS: "Bán tại quầy",
  WEBSITE: "Website linenhouse.test",
  SHOPEE: "Shopee Linen House",
  LAZADA: "Lazada Linen House",
  TIKTOK_SHOP: "TikTok Shop Linen House",
  FACEBOOK: "Fanpage Linen House",
};

const FIRST = ["Anh", "Châu", "Bảo", "Tâm", "Yến", "Hân", "Thắng", "Trâm", "Linh", "Khoa", "Ngọc", "Phúc", "Vy", "Quân", "My", "Duy", "Thảo", "Nam", "Hà", "Long"];
const MIDDLE = ["Minh", "Ngọc", "Quốc", "Thanh", "Hải", "Gia", "Đức", "Bích", "Thu", "Hoàng"];
const LAST = ["Nguyễn", "Lê", "Phạm", "Võ", "Đặng", "Trịnh", "Hồ", "Ngô", "Trần", "Bùi"];

// Orders per hour of day (Vietnam time): lunch and evening peaks.
const HOUR_WEIGHTS: readonly (readonly [number, number])[] = Array.from({ length: 15 }, (_, i) => {
  const h = i + 8; // 08:00 – 22:00
  const w = Math.exp(-((h - 12) ** 2) / 5) + 1.3 * Math.exp(-((h - 20) ** 2) / 4) + 0.25;
  return [h, w] as const;
});

const VN_OFFSET = 7 * 3600_000;
function vnMidnight(daysAgo: number) {
  const local = new Date(Date.now() + VN_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET - daysAgo * 86_400_000;
}

async function main() {
  // ---- reset --------------------------------------------------------------
  const emails = ["admin", "manager", "staff", "staff2"].map((u) => `${u}@linenhouse.test`);
  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- tenant, roles, people ---------------------------------------------
  const tenant = await prisma.tenant.create({ data: { name: "Linen House", slug: SLUG, status: "ACTIVE", plan: "GROWTH" } });
  const roleNames: Record<RoleKey, string> = { ADMIN: "Admin", MANAGER: "Quản lý", STAFF: "Nhân viên" };
  const roles = Object.fromEntries(
    await Promise.all(
      ROLE_KEYS.map(async (key) => [
        key,
        await prisma.role.create({ data: { tenantId: tenant.id, key, name: roleNames[key], permissions: [...ROLE_PERMISSIONS[key]], isSystem: true } }),
      ]),
    ),
  ) as Record<RoleKey, { id: string }>;

  const [q1, hk, wh] = await Promise.all([
    prisma.location.create({ data: { tenantId: tenant.id, name: "Chi nhánh Quận 1", code: "CN01", address: "68 Lê Lợi, Quận 1, TP.HCM" } }),
    prisma.location.create({ data: { tenantId: tenant.id, name: "Chi nhánh Hoàn Kiếm", code: "CN02", address: "12 Hàng Bông, Hoàn Kiếm, Hà Nội" } }),
    prisma.location.create({ data: { tenantId: tenant.id, name: "Kho tổng Thủ Đức", code: "KHO", type: "WAREHOUSE", address: "KCN Linh Trung, Thủ Đức" } }),
  ]);

  const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=200&h=200&fit=crop`;
  const people = [
    { email: emails[0], fullName: "Trần Thu Hà", role: "ADMIN" as const, avatarUrl: unsplash("photo-1484863137850-59afcfe05386") },
    { email: emails[1], fullName: "Phạm Quang Huy", role: "MANAGER" as const, avatarUrl: unsplash("photo-1757744705465-ea08b0ddc38a") },
    { email: emails[2], fullName: "Lê Minh Thư", role: "STAFF" as const, avatarUrl: null, locations: [q1.id] },
    { email: emails[3], fullName: "Nguyễn Gia Huy", role: "STAFF" as const, avatarUrl: unsplash("photo-1599548713969-3460f26dc07e"), locations: [q1.id] },
  ];
  const users: Record<string, string> = {};
  for (const p of people) {
    const u = await prisma.user.create({ data: { email: p.email, fullName: p.fullName, passwordHash, avatarUrl: p.avatarUrl } });
    users[p.email] = u.id;
    await prisma.membership.create({
      data: {
        userId: u.id,
        tenantId: tenant.id,
        roleId: roles[p.role].id,
        locations: p.locations ? { create: p.locations.map((locationId) => ({ locationId })) } : undefined,
      },
    });
  }
  const [adminId, managerId, staffId, staff2Id] = emails.map((e) => users[e]);

  // ---- channels -------------------------------------------------------------
  const channels = {} as Record<ChannelType, string>;
  for (const [type] of CHANNEL_MIX) {
    const c = await prisma.channel.create({
      data: { tenantId: tenant.id, type, name: CHANNEL_NAMES[type], status: "CONNECTED", defaultLocationId: type === "POS" ? q1.id : wh.id, lastSyncedAt: new Date() },
    });
    channels[type] = c.id;
  }

  // ---- catalogue & stock -------------------------------------------------
  const categories: Record<string, string> = {};
  for (const name of new Set(CATALOG.map((c) => c.category))) {
    categories[name] = (await prisma.category.create({ data: { tenantId: tenant.id, name } })).id;
  }

  type V = { id: string; sku: string; name: string; productName: string; price: number; cost: number; weight: number };
  const variants: V[] = [];
  const inventory: Prisma.InventoryLevelCreateManyInput[] = [];
  for (const [pi, p] of CATALOG.entries()) {
    const sizes = p.sizes ?? SIZES;
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        slug: p.sku.toLowerCase(),
        categoryId: categories[p.category],
        brand: "Linen House",
        options: [{ name: "Màu", values: p.colors }, ...(p.sizes ? [] : [{ name: "Size", values: sizes }])],
      },
    });
    for (const color of p.colors) {
      for (const size of sizes) {
        // Colour code: first two letters of a one-word colour, initials otherwise ("Hoạ tiết sen" → HTS).
        const words = color.split(" ");
        const colorCode = (words.length === 1 ? color.slice(0, 2) : words.map((w) => w[0]).join("")).toUpperCase();
        const sku = `${p.sku}-${colorCode}${size === "One size" ? "" : `-${size}`}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/Đ/g, "D");
        const v = await prisma.productVariant.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            sku,
            barcode: `893${String(int(100000000, 999999999))}`,
            name: size === "One size" ? color : `${color}, ${size}`,
            attributes: size === "One size" ? { Màu: color } : { Màu: color, Size: size },
            price: p.price,
            costPrice: p.cost,
          },
        });
        variants.push({ id: v.id, sku, name: v.name, productName: p.name, price: p.price, cost: p.cost, weight: POPULARITY[pi] * (size === "M" ? 1.5 : 1) });
        for (const loc of [q1, hk, wh]) {
          inventory.push({
            tenantId: tenant.id,
            variantId: v.id,
            locationId: loc.id,
            onHand: loc.id === wh.id ? int(40, 160) : int(8, 45),
            reorderPoint: loc.id === wh.id ? 20 : 5,
          });
        }
      }
    }
  }
  // A few deliberately low rows so the dashboard has something to warn about.
  const lowTargets: [string, string, number][] = [
    ["LN-CT-BE-M", q1.id, 4],
    ["TC-QD-TN", q1.id, 2],
    ["DS-CV-DE-S", hk.id, 3],
    ["QD-OS-DE-M", hk.id, 1],
    ["CV-XL-BE-M", q1.id, 5],
    ["SB-LN-XR-L", wh.id, 12],
    ["KL-VG-HTS", hk.id, 0],
  ];
  for (const [sku, loc, qty] of lowTargets) {
    const v = variants.find((x) => x.sku === sku);
    const row = v && inventory.find((i) => i.variantId === v.id && i.locationId === loc);
    if (row) row.onHand = qty;
  }
  await prisma.inventoryLevel.createMany({ data: inventory });

  // Every variant is listed on each online channel (POS sells straight from the shelf).
  const listings: Prisma.ChannelListingCreateManyInput[] = [];
  for (const [type] of CHANNEL_MIX) {
    if (type === "POS") continue;
    for (const v of variants) {
      listings.push({ channelId: channels[type], variantId: v.id, externalId: `${type.slice(0, 2)}-${v.sku}`, externalSku: v.sku, syncStatus: "SYNCED", lastSyncedAt: new Date() });
    }
  }
  await prisma.channelListing.createMany({ data: listings });

  // ---- customers -----------------------------------------------------------
  const customers: string[] = [];
  for (let i = 0; i < 40; i++) {
    const c = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        fullName: `${pick(LAST)} ${pick(MIDDLE)} ${pick(FIRST)}`,
        phone: `09${String(10_000_000 + i * 2_371_113).slice(0, 8)}`,
        tags: i < 6 ? ["VIP"] : [],
        loyaltyPoints: int(0, 2400),
      },
    });
    customers.push(c.id);
  }

  // ---- orders ----------------------------------------------------------------
  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const variantWeights = variants.map((v) => [v, v.weight] as const);
  const now = Date.now();
  let seq = 1;

  for (let d = DAYS - 1; d >= 0; d--) {
    const dayStart = vnMidnight(d);
    const weekday = new Date(dayStart + VN_OFFSET).getUTCDay(); // 0 = Sunday
    const weekend = weekday === 0 || weekday === 6;
    // gentle growth trend over the period + weekend bump
    const count = Math.round((55 + (DAYS - d) * 0.6) * (weekend ? 1.35 : 1) * (0.9 + rand() * 0.2));

    for (let n = 0; n < count; n++) {
      const hour = weighted(HOUR_WEIGHTS);
      const placedAt = new Date(dayStart + hour * 3600_000 + int(0, 3599) * 1000);
      if (placedAt.getTime() > now) continue; // today: only orders that already happened

      const channel = weighted(CHANNEL_MIX);
      const isPos = channel === "POS";
      const id = randomUUID();
      const lines = weighted([[1, 55], [2, 30], [3, 12], [4, 3]] as const);
      const chosen = new Map<string, { v: V; qty: number }>();
      for (let l = 0; l < lines; l++) {
        const v = weighted(variantWeights);
        const existing = chosen.get(v.id);
        chosen.set(v.id, { v, qty: (existing?.qty ?? 0) + (rand() < 0.85 ? 1 : 2) });
      }
      let subtotal = 0;
      for (const { v, qty } of chosen.values()) {
        const total = v.price * qty;
        subtotal += total;
        items.push({ id: randomUUID(), orderId: id, variantId: v.id, sku: v.sku, name: `${v.productName}, ${v.name}`, quantity: qty, unitPrice: v.price, unitCost: v.cost, total });
      }
      const shippingFee = isPos ? 0 : subtotal >= 500_000 ? 0 : 25_000;
      const discount = rand() < 0.15 ? Math.round((subtotal * 0.1) / 1000) * 1000 : 0;
      const total = subtotal - discount + shippingFee;

      const ageHours = (now - placedAt.getTime()) / 3600_000;
      let status: OrderStatus;
      if (rand() < 0.022) status = "CANCELLED";
      else if (isPos) status = "COMPLETED";
      else if (ageHours < 3) status = weighted([["PENDING", 5], ["CONFIRMED", 3]] as const);
      else if (ageHours < 24) status = weighted([["CONFIRMED", 2], ["PROCESSING", 3], ["SHIPPING", 4]] as const);
      else if (ageHours < 72) status = weighted([["SHIPPING", 4], ["COMPLETED", 6]] as const);
      else status = "COMPLETED";

      const done = status === "COMPLETED";
      orders.push({
        id,
        tenantId: tenant.id,
        code: `DH-${String(seq++).padStart(6, "0")}`,
        channelId: channels[channel],
        channelType: channel,
        externalOrderId: isPos ? null : `${channel.slice(0, 2)}${int(10_000_000, 99_999_999)}`,
        locationId: isPos ? q1.id : wh.id,
        customerId: isPos && rand() < 0.45 ? null : pick(customers),
        status,
        paymentStatus: done || isPos ? "PAID" : status === "CANCELLED" ? "UNPAID" : rand() < 0.5 ? "PAID" : "UNPAID",
        fulfillmentStatus: done ? "FULFILLED" : status === "SHIPPING" ? "FULFILLED" : "UNFULFILLED",
        subtotal,
        discountTotal: discount,
        shippingFee,
        total,
        // POS orders are rung up by a cashier (Gia Huy sells the most); online orders are assigned for packing.
        createdById: isPos ? weighted([[staff2Id, 5], [staffId, 3], [managerId, 1]] as const) : null,
        assignedToId: isPos ? null : weighted([[staffId, 4], [staff2Id, 3], [managerId, 2]] as const),
        placedAt,
        completedAt: done ? new Date(placedAt.getTime() + (isPos ? 0 : int(24, 72) * 3600_000)) : null,
        cancelledAt: status === "CANCELLED" ? new Date(placedAt.getTime() + 3600_000) : null,
      });
      if (done || isPos) {
        payments.push({
          orderId: id,
          method: isPos ? weighted<PaymentMethod>([["CASH", 4], ["BANK_TRANSFER", 4], ["CARD", 2]]) : weighted<PaymentMethod>([["EWALLET", 5], ["COD", 4], ["BANK_TRANSFER", 1]]),
          amount: total,
          paidAt: placedAt,
        });
      }
    }
  }

  const chunk = <T,>(arr: T[], size = 1000) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
  for (const c of chunk(orders)) await prisma.order.createMany({ data: c });
  for (const c of chunk(items)) await prisma.orderItem.createMany({ data: c });
  for (const c of chunk(payments)) await prisma.payment.createMany({ data: c });
  await prisma.tenant.update({ where: { id: tenant.id }, data: { orderSeq: seq - 1 } });

  // Customer aggregates (normally maintained when an order completes).
  await prisma.$executeRaw`
    UPDATE "Customer" c SET
      "orderCount" = s.cnt, "totalSpent" = s.spent, "lastOrderAt" = s.last
    FROM (
      SELECT "customerId", COUNT(*)::int AS cnt, SUM(total) AS spent, MAX("placedAt") AS last
      FROM "Order" WHERE "tenantId" = ${tenant.id} AND status = 'COMPLETED' AND "customerId" IS NOT NULL
      GROUP BY "customerId"
    ) s
    WHERE c.id = s."customerId"`;

  await prisma.activityLog.create({ data: { tenantId: tenant.id, actorId: adminId, action: "tenant.seeded", entityType: "Tenant", entityId: tenant.id } });

  console.log(`Seeded "${tenant.name}": ${variants.length} variants, ${customers.length} customers, ${orders.length} orders, ${items.length} order lines.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
