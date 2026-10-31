"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PLANS } from "./content";
import { revealStagger } from "./reveal";

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="bang-gia" aria-labelledby="pricing-heading" className="mx-auto max-w-[1400px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
      <div data-reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 id="pricing-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
            Giá rõ ràng, không thu theo đơn
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed font-light text-muted-foreground">Dùng thử 14 ngày mọi tính năng. Đổi gói hoặc dừng bất cứ lúc nào.</p>
        </div>
        {/* Each side label selects its own period; the switch in between toggles. */}
        <div className="inline-flex items-center gap-3 text-[15px] font-medium">
          <button type="button" onClick={() => setYearly(false)} className={cn("cursor-pointer", yearly ? "text-muted-foreground" : "text-foreground")}>
            Theo tháng
          </button>
          <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Thanh toán theo năm" />
          <button type="button" onClick={() => setYearly(true)} className={cn("cursor-pointer", yearly ? "text-foreground" : "text-muted-foreground")}>
            Theo năm <span className="ml-1 rounded-full bg-lime px-2 py-0.5 text-xs font-medium text-lime-foreground">tiết kiệm 20%</span>
          </button>
        </div>
      </div>

      <ul data-reveal-stagger style={revealStagger(120)} className="mt-12 grid gap-3 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          return (
            <li
              key={p.name}
              className={cn(
                "hover-lift relative flex flex-col rounded-3xl p-6 sm:p-8",
                p.highlighted ? "bg-lime text-lime-foreground" : "bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-normal tracking-[-0.02em]">{p.name}</h3>
                {p.highlighted && <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground">Được chọn nhiều nhất</span>}
              </div>
              <p className={cn("mt-2 min-h-12 text-[15px] font-light", p.highlighted ? "opacity-75" : "text-muted-foreground")}>{p.description}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                {price === null ? (
                  <span className="text-4xl font-light tracking-[-0.03em]">Báo giá riêng</span>
                ) : (
                  <>
                    <span className="text-5xl font-light tracking-[-0.04em] tabular">{formatVND(price)}</span>
                    <span className={cn("text-sm", p.highlighted ? "opacity-70" : "text-muted-foreground")}>/tháng</span>
                  </>
                )}
              </p>
              <p className={cn("mt-1 h-5 text-sm", p.highlighted ? "opacity-70" : "text-muted-foreground")}>
                {price !== null && yearly ? `Thanh toán ${formatVND(price * 12)} mỗi năm` : price !== null ? "Thanh toán hằng tháng" : ""}
              </p>
              <Link
                href={p.monthly === null ? "#lien-he" : "/register"}
                className={cn(
                  buttonVariants({ variant: p.highlighted ? "default" : "outline", size: "xl" }),
                  "mt-6 w-full",
                  // on the lime card the pill stays black in both themes
                  p.highlighted && "bg-lime-foreground text-lime hover:bg-lime-foreground/85",
                )}
              >
                {p.cta}
              </Link>
              <ul className={cn("mt-8 space-y-3 border-t pt-6 text-[15px] font-light", p.highlighted ? "border-lime-foreground/15" : "border-border")}>
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className={cn("mt-0.5 size-[18px] shrink-0", p.highlighted ? "" : "text-success")} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">Giá chưa gồm VAT. Hoá đơn VAT được xuất khi thanh toán.</p>
    </section>
  );
}
