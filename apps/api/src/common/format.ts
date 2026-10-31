const vnd = new Intl.NumberFormat("vi-VN");

/** 1250000 → "1.250.000₫" for user-facing API messages. */
export const formatVnd = (n: number) => `${vnd.format(Math.round(n))}₫`;
