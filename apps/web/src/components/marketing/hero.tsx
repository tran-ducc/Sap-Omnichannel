import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, Play, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNELS, COPY, type ChannelKey } from "./content";
import { ParcelStack, Sparkle } from "./decor";
import { PHOTOS } from "./photos";
import { revealDelay, revealStagger } from "./reveal";

const BARS = [38, 52, 30, 70, 46, 84, 58, 40, 66];
const HERO_CHANNELS: ChannelKey[] = ["pos", "website", "shopee", "lazada", "tiktok", "facebook"];

/**
 * Hero board. On large screens the right column is a composed "canvas" of
 * absolutely positioned cards joined by connector lines; below lg the same
 * cards fall back into a simple two-column grid and the lines are hidden.
 */
export function Hero() {
  return (
    <section className="px-3 pt-2 sm:px-5">
      <div className="relative mx-auto grid max-w-[1400px] overflow-hidden rounded-3xl bg-board lg:grid-cols-[1.1fr_1fr]">
        {/* ---------------- Left ---------------- */}
        <div data-reveal-stagger style={revealStagger(110)} className="relative z-10 px-6 pt-10 pb-10 sm:px-10 lg:px-14 lg:pt-16 lg:pb-14">
          <p className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <RefreshCw className="size-3.5" aria-hidden />
            </span>
            {COPY.heroBadge}
          </p>

          <h1 className="mt-7 text-[2.75rem] leading-[1.04] font-normal tracking-[-0.04em] sm:text-6xl lg:text-[4.4rem]">
            Một kho hàng.
            <br />
            Mọi kênh bán.
          </h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed font-light text-muted-foreground">
            {COPY.heroLead}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/register" className={buttonVariants({ size: "xl" })}>
              Dùng thử miễn phí
            </Link>
            <a
              href="#demo"
              className="group inline-flex items-center gap-2.5 rounded-full text-[15px] font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-9 items-center justify-center rounded-full border border-foreground/70 transition-colors group-hover:bg-foreground group-hover:text-background">
                <Play className="size-3.5 fill-current" aria-hidden />
              </span>
              Xem giao diện
            </a>
          </div>

          {/* Integration card */}
          <div className="relative mt-14 flex flex-col gap-6 sm:flex-row sm:items-center lg:mt-20">
            <div className="relative h-32 w-40 shrink-0">
              <div className="absolute -top-3 -left-3 size-20 rounded-2xl bg-lime-soft" aria-hidden />
              <Image src={PHOTOS.packing.src} alt={PHOTOS.packing.alt} fill sizes="160px" className="rounded-2xl object-cover" />
              <Sparkle className="absolute -bottom-6 -left-5 hidden sm:block" />
            </div>
            <div className="max-w-xs">
              <h2 className="text-lg font-medium">{COPY.channelCard.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed font-light text-muted-foreground">
                {COPY.channelCard.body}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Các kênh bán được hỗ trợ">
                {HERO_CHANNELS.map((c) => (
                  <li key={c} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium">
                    <span className="size-1.5 rounded-full" style={{ background: CHANNELS[c].color }} aria-hidden />
                    {CHANNELS[c].label}
                  </li>
                ))}
              </ul>
            </div>
            {/* Connector from photo to the card's baseline (reference detail) */}
            <svg className="pointer-events-none absolute -bottom-8 left-[-14px] hidden h-10 w-72 sm:block" aria-hidden>
              <path d="M1 0v30a8 8 0 0 0 8 8h260" className="fill-none stroke-foreground/60" strokeWidth="1" />
            </svg>
          </div>
        </div>

        {/* ---------------- Right canvas ---------------- */}
        <div className="relative grid grid-cols-2 gap-4 border-border px-6 pb-8 sm:px-10 lg:block lg:min-h-[680px] lg:border-l lg:p-0">
          {/* glow behind the portrait */}
          <div className="glow-lime pointer-events-none absolute top-[38%] right-[-4%] hidden h-[26rem] w-[26rem] lg:block" aria-hidden />

          {/* connector lines (lg only) */}
          <svg className="pointer-events-none absolute inset-0 hidden size-full lg:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M58 50 H52 V72 H70" className="fill-none stroke-foreground/50" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path d="M6 76 H94" className="fill-none stroke-foreground/50" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <Sparkle className="absolute top-[57%] left-[50.6%] hidden lg:block" />
          <Sparkle className="absolute top-[74.6%] left-[69%] hidden lg:block" />

          {/* signal arcs + arrow button */}
          <svg className="absolute top-[3%] right-[10%] hidden h-24 w-24 lg:block" viewBox="0 0 96 96" aria-hidden>
            {[30, 46, 62].map((r) => (
              <path key={r} d={`M${96 - r} 4 A ${r} ${r} 0 0 1 92 ${r}`} className="fill-none stroke-foreground/40" strokeWidth="1" />
            ))}
          </svg>
          <a
            href="#tinh-nang"
            aria-label="Xem tính năng"
            className="absolute top-[9%] right-[30%] hidden size-14 items-center justify-center rounded-full bg-ink text-ink-foreground transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:flex"
          >
            <ArrowDownRight className="size-6" aria-hidden />
          </a>

          {/* Revenue stat card */}
          <div data-reveal style={revealDelay(250)} className="z-10 rounded-2xl bg-card p-5 shadow-[0_20px_40px_-24px_rgb(18_20_16/0.35)] lg:absolute lg:top-[8%] lg:left-[7%] lg:w-[230px]">
            <p className="text-center text-xl font-medium tracking-tight tabular">48.250.000₫</p>
            <p className="mt-0.5 text-center text-xs text-muted-foreground">Doanh thu hôm nay</p>
            <div className="mt-4 flex h-20 items-end justify-center gap-2" aria-hidden>
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className="w-2 rounded-full"
                  style={{ height: `${h}%`, background: "linear-gradient(to top, var(--lime) 0%, color-mix(in oklab, var(--lime) 25%, transparent) 100%)" }}
                />
              ))}
            </div>
          </div>

          {/* Dark donut card — overlaps the divider like the reference */}
          <div data-reveal style={revealDelay(400)} className="z-10 flex flex-col items-center justify-center rounded-2xl bg-night p-4 text-night-foreground lg:absolute lg:top-[47%] lg:left-[-58px] lg:w-[128px]">
            <div className="relative size-16">
              <svg viewBox="0 0 48 48" className="size-16 -rotate-90" aria-hidden>
                <circle cx="24" cy="24" r="19" className="fill-none stroke-night-foreground/15" strokeWidth="5" />
                <circle cx="24" cy="24" r="19" className="fill-none stroke-lime" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${0.62 * 119.4} 119.4`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium tabular">62%</span>
            </div>
            <p className="mt-2 text-center text-xs leading-tight">Đơn từ sàn TMĐT</p>
            <p className="mt-0.5 text-[10px] opacity-60">Tuần này</p>
          </div>

          {/* Copy beside the arrow */}
          <p data-reveal style={revealDelay(350)} className="col-span-2 text-sm leading-relaxed lg:absolute lg:top-[24%] lg:right-[6%] lg:col-span-1 lg:w-44">
            Bán ở quầy hay trên sàn, tồn kho vẫn khớp với <strong className="font-semibold">Sạp</strong>
          </p>

          {/* Portrait */}
          <div data-reveal style={revealDelay(500)} className="relative col-span-2 aspect-[6/5] lg:absolute lg:top-[36%] lg:right-[6%] lg:aspect-auto lg:h-[210px] lg:w-[250px]">
            <Image src={PHOTOS.owner.src} alt={PHOTOS.owner.alt} fill sizes="(min-width: 1024px) 250px, 90vw" className="rounded-3xl object-cover" priority />
            {/* New-order toast */}
            <div className="absolute -bottom-4 left-4 flex items-center gap-2 rounded-full bg-card py-1.5 pr-3.5 pl-2 text-xs shadow-[0_12px_24px_-12px_rgb(18_20_16/0.4)] lg:-left-16">
              <span className="flex size-6 items-center justify-center rounded-full bg-lime text-[10px] font-semibold text-lime-foreground">+1</span>
              <span>
                Đơn mới từ <span className="font-medium">TikTok Shop</span>
              </span>
            </div>
          </div>

          {/* Store count */}
          <div data-reveal style={revealDelay(650)} className={cn("col-span-2 mt-6 flex items-end justify-between lg:absolute lg:right-[8%] lg:bottom-[6%] lg:left-[8%] lg:mt-0")}>
            <div>
              <p className="text-6xl font-light tracking-[-0.04em] tabular">
                12.400<span className="text-3xl">+</span>
              </p>
              <p className="mt-1 max-w-[12rem] text-sm text-muted-foreground">cửa hàng đã bán hàng cùng Sạp</p>
            </div>
            <ParcelStack />
          </div>
        </div>
      </div>
    </section>
  );
}
