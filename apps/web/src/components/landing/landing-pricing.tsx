"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { useState } from "react";
import { PLANS } from "@/components/marketing/content";
import { revealStagger } from "@/components/marketing/reveal";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./bits";

/** Forest section; the recommended plan is the paper card (like the hero's 94% card). */
export function LandingPricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="bang-gia" aria-labelledby="pricing-heading" className="bg-forest text-forest-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div data-reveal className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionLabel index="06">Bảng giá</SectionLabel>
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <h2 id="pricing-heading" className="max-w-xl text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
              Giá rõ ràng, không thu theo đơn
            </h2>
            <div role="radiogroup" aria-label="Chu kỳ thanh toán" className="inline-flex shrink-0 border border-forest-foreground/30 p-1 text-xs font-medium tracking-[0.12em] uppercase">
              {[
                { v: false, label: "Theo tháng" },
                { v: true, label: "Theo năm −20%" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={yearly === o.v}
                  onClick={() => setYearly(o.v)}
                  className={cn("h-10 cursor-pointer px-4 transition-colors duration-300", yearly === o.v ? "bg-lime text-lime-foreground" : "hover:bg-forest-foreground/10")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul data-reveal-stagger style={revealStagger(120)} className="mt-16 grid gap-px bg-forest-foreground/20 lg:grid-cols-3">
          {PLANS.map((p) => {
            const price = yearly ? p.yearly : p.monthly;
            const hl = p.highlighted;
            return (
              <li key={p.name} className={cn("flex flex-col p-7 sm:p-9", hl ? "bg-paper text-paper-foreground" : "bg-forest")}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-light tracking-[-0.02em]">{p.name}</h3>
                  {hl && <span className="bg-lime px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-lime-foreground uppercase">Chọn nhiều nhất</span>}
                </div>
                <p className={cn("mt-2 min-h-12 text-[15px] font-light", hl ? "text-paper-muted" : "text-forest-foreground/70")}>{p.description}</p>
                <p className="mt-10 flex items-baseline gap-1.5">
                  {price === null ? (
                    <span className="text-[clamp(2.2rem,3.4vw,3rem)] leading-none font-light tracking-[-0.04em]">Báo giá riêng</span>
                  ) : (
                    <>
                      <span className="text-[clamp(2.8rem,4.4vw,4rem)] leading-none font-light tracking-[-0.05em] tabular">{formatVND(price)}</span>
                      <span className="text-sm opacity-70">/tháng</span>
                    </>
                  )}
                </p>
                <p className="mt-2 h-5 text-sm opacity-70">{price !== null && yearly ? `Thanh toán ${formatVND(price * 12)} mỗi năm` : price !== null ? "Thanh toán hằng tháng" : ""}</p>
                <Link
                  href={p.monthly === null ? "#lien-he" : "/register"}
                  className={cn(
                    "group mt-8 flex h-12 items-center justify-between px-5 text-sm font-medium transition-colors duration-300",
                    hl ? "bg-forest text-forest-foreground hover:bg-forest-deep" : "border border-forest-foreground/35 hover:border-lime hover:bg-lime hover:text-lime-foreground",
                  )}
                >
                  {p.cta}
                  <ArrowUpRight className="size-4 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
                <ul className={cn("mt-8 space-y-3 border-t pt-6 text-[15px] font-light", hl ? "border-paper-foreground/20" : "border-forest-foreground/20")}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={cn("mt-0.5 size-[18px] shrink-0", hl ? "text-forest" : "text-lime")} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-forest-foreground/60">Giá chưa gồm VAT. Hoá đơn VAT được xuất khi thanh toán.</p>
      </div>
    </section>
  );
}
