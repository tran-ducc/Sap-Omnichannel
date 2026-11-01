import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { can, type Page, type ProductDetail, type ProductListItem } from "@omni/shared";
import { Prisma } from "@prisma/client";
import { locationWhere } from "../../common/location-scope";
import type { AuthUser } from "../../common/permissions.guard";
import { PrismaService } from "../../prisma/prisma.module";
import { ChannelSyncService } from "../channels/channel-sync.service";
import { InventoryService, toLevel } from "../inventory/inventory.service";
import type { CreateProductDto, ProductQuery, UpdateProductDto, UpdateVariantDto } from "./catalog.dto";

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly channelSync: ChannelSyncService,
  ) {}

  async list(user: AuthUser, q: ProductQuery): Promise<Page<ProductListItem>> {
    const search = q.q?.trim();
    const where: Prisma.ProductWhereInput = {
      tenantId: user.tenantId,
      deletedAt: q.status === "ARCHIVED" ? undefined : null,
      status: q.status ?? { not: "ARCHIVED" },
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { variants: { some: { OR: [{ sku: { contains: search, mode: "insensitive" } }, { barcode: { contains: search } }] } } },
        ],
      }),
    };
    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          category: { select: { name: true } },
          variants: {
            where: { isActive: true },
            select: {
              price: true,
              inventory: { where: locationWhere(user), select: { onHand: true, reorderPoint: true } },
              listings: { select: { channel: { select: { type: true } } } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: q.page,
      limit: q.limit,
      items: products.map((p) => {
        const prices = p.variants.map((v) => Number(v.price));
        const levels = p.variants.flatMap((v) => v.inventory);
        return {
          id: p.id,
          name: p.name,
          category: p.category?.name ?? null,
          status: p.status,
          imageUrl: p.imageUrls[0] ?? null,
          variantCount: p.variants.length,
          priceMin: prices.length ? Math.min(...prices) : 0,
          priceMax: prices.length ? Math.max(...prices) : 0,
          totalOnHand: levels.reduce((s, l) => s + l.onHand, 0),
          lowStockLevels: levels.filter((l) => l.onHand <= l.reorderPoint).length,
          channels: [...new Set(p.variants.flatMap((v) => v.listings.map((l) => l.channel.type)))],
        };
      }),
    };
  }

  async get(user: AuthUser, id: string): Promise<ProductDetail> {
    const p = await this.prisma.product.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        category: { select: { name: true } },
        variants: {
          orderBy: { sku: "asc" },
          include: { inventory: { where: locationWhere(user) }, listings: { include: { channel: { select: { type: true } } } } },
        },
      },
    });
    if (!p) throw new NotFoundException("Không tìm thấy sản phẩm");
    const seeCost = can(user.role, "product:update_price");
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      brand: p.brand,
      categoryId: p.categoryId,
      category: p.category?.name ?? null,
      status: p.status,
      options: (p.options as ProductDetail["options"]) ?? [],
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        attributes: v.attributes as Record<string, string>,
        price: Number(v.price),
        ...(seeCost && { costPrice: num(v.costPrice) }),
        isActive: v.isActive,
        levels: v.inventory.map(toLevel),
        listings: v.listings.map((l) => ({
          channelType: l.channel.type,
          syncStatus: l.syncStatus,
          lastSyncedAt: l.lastSyncedAt?.toISOString() ?? null,
          lastError: l.lastError,
        })),
      })),
    };
  }

  /**
   * Creates the product, its variants, opening stock (as PURCHASE movements
   * so the ledger starts from zero) and channel listings in one transaction.
   */
  async create(user: AuthUser, dto: CreateProductDto) {
    const skus = dto.variants.map((v) => v.sku);
    const dupe = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dupe) throw new BadRequestException(`SKU ${dupe} bị lặp trong danh sách mẫu`);
    if (!can(user.role, "product:update_price") && dto.variants.some((v) => v.costPrice !== undefined)) {
      throw new ForbiddenException("Vai trò của bạn không được nhập giá vốn");
    }
    if (dto.categoryId && !(await this.prisma.category.count({ where: { id: dto.categoryId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Không tìm thấy danh mục");
    }
    const stockLocations = [...new Set(dto.variants.flatMap((v) => v.initialStock?.map((s) => s.locationId) ?? []))];
    if (stockLocations.length && (await this.prisma.location.count({ where: { id: { in: stockLocations }, tenantId: user.tenantId } })) !== stockLocations.length) {
      throw new NotFoundException("Không tìm thấy chi nhánh hoặc kho");
    }
    const channels = dto.channelTypes?.length
      ? await this.prisma.channel.findMany({ where: { tenantId: user.tenantId, type: { in: dto.channelTypes } }, select: { id: true } })
      : [];

    const baseSlug = slugify(dto.name) || "san-pham";
    const slugTaken = await this.prisma.product.count({ where: { tenantId: user.tenantId, slug: { startsWith: baseSlug } } });

    let created: { productId: string; variantIds: string[]; changes: { variantId: string; level: ReturnType<typeof toLevel>; delta: number }[] };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId: user.tenantId,
            name: dto.name,
            slug: slugTaken ? `${baseSlug}-${slugTaken + 1}` : baseSlug,
            description: dto.description,
            brand: dto.brand,
            categoryId: dto.categoryId,
            options: dto.options.map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) })),
          },
        });
        const changes: { variantId: string; level: ReturnType<typeof toLevel>; delta: number }[] = [];
        const variantIds: string[] = [];
        for (const v of dto.variants) {
          const values = dto.options.map((o) => v.attributes[o.name]).filter(Boolean);
          const variant = await tx.productVariant.create({
            data: {
              tenantId: user.tenantId,
              productId: product.id,
              sku: v.sku,
              barcode: v.barcode,
              name: values.length ? values.join(", ") : "Mặc định",
              attributes: v.attributes,
              price: v.price,
              costPrice: v.costPrice,
            },
          });
          variantIds.push(variant.id);
          for (const s of v.initialStock ?? []) {
            if (s.quantity === 0) continue;
            const level = await this.inventory.applyMovement(tx, {
              tenantId: user.tenantId,
              variantId: variant.id,
              locationId: s.locationId,
              delta: s.quantity,
              type: "PURCHASE",
              note: "Tồn đầu kỳ khi tạo sản phẩm",
              actorId: user.userId,
            });
            changes.push({ variantId: variant.id, level: toLevel(level), delta: s.quantity });
          }
          if (channels.length) {
            await tx.channelListing.createMany({
              data: channels.map((c) => ({ channelId: c.id, variantId: variant.id, externalId: `pending-${variant.id}-${c.id}`, externalSku: v.sku })),
            });
          }
        }
        await tx.activityLog.create({
          data: { tenantId: user.tenantId, actorId: user.userId, action: "product.created", entityType: "Product", entityId: product.id, metadata: { variants: dto.variants.length } },
        });
        return { productId: product.id, variantIds, changes };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Có SKU đã tồn tại trong cửa hàng. Hãy đổi SKU rồi lưu lại.");
      }
      throw e;
    }

    await this.inventory.afterCommit(
      user.tenantId,
      created.changes.map((c) => ({ ...c, type: "PURCHASE" as const })),
      user.userId,
    );
    // New listings start PENDING; variants without opening stock still need
    // their first push (quantity 0) or they would stay pending forever.
    await this.channelSync.schedule(user.tenantId, created.variantIds);
    return this.get(user, created.productId);
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    await this.findOwned(user.tenantId, id);
    if (dto.categoryId && !(await this.prisma.category.count({ where: { id: dto.categoryId, tenantId: user.tenantId } }))) {
      throw new NotFoundException("Không tìm thấy danh mục");
    }
    await this.prisma.product.update({ where: { id }, data: dto });
    return this.get(user, id);
  }

  /** Price and cost need "product:update_price" on top of "product:update". */
  async updateVariant(user: AuthUser, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, tenantId: user.tenantId } });
    if (!variant) throw new NotFoundException("Không tìm thấy mẫu sản phẩm");
    const touchesPrice = dto.price !== undefined || dto.costPrice !== undefined;
    if (touchesPrice && !can(user.role, "product:update_price")) throw new ForbiddenException("Vai trò của bạn không được sửa giá");
    if (dto.reorderPoint !== undefined && !dto.locationId) throw new BadRequestException("Cần chọn chi nhánh khi đổi mức tồn tối thiểu");

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { price: dto.price, costPrice: dto.costPrice, barcode: dto.barcode },
      });
      if (dto.reorderPoint !== undefined && dto.locationId) {
        await tx.inventoryLevel.upsert({
          where: { variantId_locationId: { variantId, locationId: dto.locationId } },
          update: { reorderPoint: dto.reorderPoint },
          create: { tenantId: user.tenantId, variantId, locationId: dto.locationId, reorderPoint: dto.reorderPoint },
        });
      }
      if (dto.price !== undefined && dto.price !== Number(variant.price)) {
        await tx.activityLog.create({
          data: {
            tenantId: user.tenantId,
            actorId: user.userId,
            action: "product.price_changed",
            entityType: "ProductVariant",
            entityId: variantId,
            metadata: { sku: variant.sku, from: Number(variant.price), to: dto.price },
          },
        });
      }
    });
    return this.get(user, variant.productId);
  }

  /** Soft delete: history (orders, ledger) keeps pointing at the product. */
  async archive(user: AuthUser, id: string) {
    await this.findOwned(user.tenantId, id);
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } }),
      this.prisma.activityLog.create({ data: { tenantId: user.tenantId, actorId: user.userId, action: "product.archived", entityType: "Product", entityId: id } }),
    ]);
  }

  private async findOwned(tenantId: string, id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!p) throw new NotFoundException("Không tìm thấy sản phẩm");
    return p;
  }
}
