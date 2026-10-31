"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardOverview } from "@omni/shared";
import { formatVND, formatVNDCompact } from "@/lib/format";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function label(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Lime area on the always-dark card (app reference "Efficiency" card).
 * Today is still in progress, so its segment is drawn dashed instead of
 * looking like a sudden drop.
 */
export function RevenueChart({ daily }: { daily: DashboardOverview["daily"] }) {
  const last = daily.length - 1;
  const data = daily.map((d, i) => ({
    name: i === last ? "Hôm nay" : label(d.date),
    full: i < last ? d.total : null,
    // the partial series starts at yesterday so the two lines join
    partial: i >= last - 1 ? d.total : null,
    total: d.total,
  }));
  const best = daily.slice(0, last).reduce((a, b) => (b.total > a.total ? b : a), daily[0]);

  return (
    <figure className="h-full">
      <div className="h-48 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--lime)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--night-foreground)", opacity: 0.6, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--night-foreground)", strokeOpacity: 0.25 }}
              contentStyle={{ background: "var(--card)", border: "none", borderRadius: 16, color: "var(--foreground)", fontSize: 13 }}
              // one row per day regardless of which series the point belongs to
              formatter={(v, key, item) => (key === "partial" && item.payload.full != null ? [null, null] : [formatVND(Number(v)), key === "partial" ? "Đến hiện tại" : "Doanh thu"])}
            />
            <Area type="monotone" dataKey="full" stroke="var(--lime)" strokeWidth={2.5} fill="url(#rev-area)" connectNulls={false} activeDot={{ r: 5, fill: "var(--lime)", stroke: "var(--night)", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="partial" stroke="var(--lime)" strokeWidth={2} strokeDasharray="5 5" fill="none" connectNulls={false} activeDot={{ r: 5, fill: "var(--night)", stroke: "var(--lime)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Text alternative for screen readers */}
      <figcaption className="sr-only">
        Doanh thu 7 ngày gần nhất, hôm nay tính đến hiện tại. Cao nhất {best ? `${label(best.date)}: ${formatVND(best.total)}` : "chưa có dữ liệu"}.
        <table>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <th>{d.name}</th>
                <td>{formatVNDCompact(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
