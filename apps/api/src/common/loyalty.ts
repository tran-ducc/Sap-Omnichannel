/** One loyalty point per 10.000₫ spent. Used when points are earned (POS checkout) and taken back (returns). */
const POINTS_PER_VND = 10_000;

export const loyaltyPointsFor = (total: number) => Math.floor(total / POINTS_PER_VND);

/** Orders created by POS checkout carry this external id prefix (idempotency key `pos:{clientRef}`). */
export const POS_CHECKOUT_REF_PREFIX = "pos:";
