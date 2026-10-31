const vnd = new Intl.NumberFormat("vi-VN");

/** 1250000 → "1.250.000₫" */
export function formatVND(amount: number): string {
  return `${vnd.format(Math.round(amount))}₫`;
}

/** 48250000 → "48,3 tr" — compact form for KPI cards and chart axes. */
export function formatVNDCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (amount >= 1_000) return `${(amount / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return vnd.format(amount);
}

export function formatNumber(n: number): string {
  return vnd.format(n);
}

/** "vừa xong", "12 phút trước", "3 giờ trước", then a short date-time. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 6 * 3600) return `${Math.floor(diff / 3600)} giờ trước`;
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
