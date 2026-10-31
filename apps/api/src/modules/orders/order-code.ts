import type { Prisma } from "@prisma/client";

/** Next human-readable order code for a shop ("DH-000123"), from an atomic counter. Call inside the order's transaction. */
export async function nextOrderCode(tx: Prisma.TransactionClient, tenantId: string) {
  const { orderSeq } = await tx.tenant.update({ where: { id: tenantId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
  return `DH-${String(orderSeq).padStart(6, "0")}`;
}
