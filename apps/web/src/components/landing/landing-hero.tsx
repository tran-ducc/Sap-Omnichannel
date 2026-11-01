import Image from "next/image";
import { SHOP_NAMES } from "@/components/marketing/content";
import { PHOTOS } from "@/components/marketing/photos";
import { revealDelay, revealStagger } from "@/components/marketing/reveal";
import { LensFrame, RoundCta } from "./bits";

/**
 * Full-bleed green hero (reference: Holganix). A toned shop photo fills the
 * frame; the "object in a lens" is a parcel photo inside a crosshair frame,
 * with the lime round CTA overlapping it and a quote card to the right.
 */
export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-forest-deep text-forest-foreground">
      {/* Background photo, toned green. Tweak the overlay opacity to taste. */}
      <Image src={PHOTOS.boutique.src} alt="" fill priority sizes="100vw" className="-z-20 scale-105 object-cover opacity-40 blur-[2px] mix-blend-luminosity" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_70%_40%,color-mix(in_oklab,var(--forest)_55%,transparent),var(--forest-deep)_75%)]" aria-hidden />
      {/* Diagonal guide lines across the frame */}
      <svg className="pointer-events-none absolute inset-0 -z-10 hidden size-full lg:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M30 0 L100 78" className="stroke-forest-foreground/15" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M58 100 L100 58" className="stroke-forest-foreground/10" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mx-auto max-w-[1440px] px-5 pt-28 pb-10 sm:px-8 sm:pt-32 lg:px-12 lg:pt-36">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr_0.85fr] lg:gap-8">
          {/* Headline */}
          <div data-reveal-stagger style={revealStagger(120)}>
            <h1 className="text-[clamp(3.1rem,7.2vw,6.6rem)] leading-[0.98] font-light tracking-[-0.045em]">
              Một kho hàng.
              <br />
              Mọi kênh bán.
            </h1>
            <p className="mt-7 max-w-md text-[17px] leading-relaxed font-light text-forest-foreground/75">
              Sạp gom đơn từ quầy, website, Shopee, Lazada, TikTok Shop và Facebook về một nơi. Có đơn ở kênh nào, tồn kho trừ ngay ở mọi kênh còn lại.
            </p>
          </div>

          {/* Lens + parcel + round CTA */}
          <div data-reveal style={revealDelay(250)} className="relative mx-auto w-full max-w-[22rem] lg:mt-2">
            <div className="relative aspect-square">
              <LensFrame className="absolute inset-0 size-full text-forest-foreground" />
              <div className="absolute inset-[17%] overflow-hidden rounded-full ring-1 ring-forest-foreground/20">
                <Image src={PHOTOS.packing.src} alt={PHOTOS.packing.alt} fill sizes="(min-width: 1024px) 240px, 60vw" className="object-cover" />
              </div>
              {/* lime rule on the frame's right edge */}
              <span className="absolute top-[-6%] right-0 h-[112%] w-1 bg-lime" aria-hidden />
            </div>
            <RoundCta href="#tinh-nang" className="absolute -bottom-10 -left-4 sm:-left-8">
              Khám phá
            </RoundCta>
          </div>

          {/* Quote card */}
          <figure data-reveal style={revealDelay(450)} className="relative mt-8 w-full max-w-sm justify-self-end overflow-hidden bg-forest/60 ring-1 ring-forest-foreground/15 backdrop-blur-sm lg:mt-16">
            <div className="relative aspect-[16/10]">
              <Image src={PHOTOS.warehouse.src} alt={PHOTOS.warehouse.alt} fill sizes="(min-width: 1024px) 26vw, 90vw" className="object-cover opacity-85" />
            </div>
            <div className="flex items-end gap-4 p-5">
              <blockquote className="flex-1 text-sm leading-relaxed">“Không còn cảnh bán lố trên sàn rồi xin lỗi khách nữa.”</blockquote>
              <div className="relative size-12 shrink-0 overflow-hidden bg-lime">
                <Image src={PHOTOS.personHa.src} alt="" fill sizes="48px" className="object-cover" />
              </div>
            </div>
            <figcaption className="sr-only">Chị Thu Hà, chủ shop Linen House</figcaption>
          </figure>
        </div>

        {/* Stats row */}
        <div data-reveal-stagger style={revealStagger(110)} className="mt-24 grid grid-cols-2 items-end gap-x-6 gap-y-10 lg:mt-28 lg:grid-cols-[1fr_1.1fr_1.1fr_1fr] lg:gap-x-8">
          <p className="col-span-2 text-2xl leading-tight font-light tracking-[-0.02em] lg:col-span-1 lg:self-start">
            Bán đa kênh,
            <br />
            gọn một nơi
          </p>
          <div className="bg-paper p-5 text-paper-foreground sm:p-7 lg:min-h-56">
            <p className="text-[clamp(3rem,6vw,5.5rem)] leading-none font-light tracking-[-0.05em] tabular">94%</p>
            <p className="mt-3 max-w-[14rem] text-sm text-paper-muted">đơn huỷ vì hết hàng biến mất sau ba tháng dùng Sạp</p>
          </div>
          <div className="border-t border-forest-foreground/40 pt-5 lg:min-h-56">
            <p className="text-[clamp(3rem,6vw,5.5rem)] leading-none font-light tracking-[-0.05em] tabular">
              &lt;2<span className="text-[0.45em] tracking-normal">giây</span>
            </p>
            <p className="mt-3 text-sm text-forest-foreground/70">để tồn kho khớp trên mọi kênh</p>
          </div>
          <p className="col-span-2 max-w-xs text-sm leading-relaxed text-forest-foreground/80 lg:col-span-1 lg:self-start">
            Sạp cùng hơn 12.400 cửa hàng Việt đang thay đổi cách bán hàng: một kho, một hộp đơn, một màn hình báo cáo.
          </p>
        </div>
      </div>

      {/* Shop-name marquee on the hero's bottom edge */}
      <div className="border-t border-forest-foreground/15">
        <div className="marquee py-5 text-xs font-medium tracking-[0.18em] text-forest-foreground/70 uppercase [--marquee-duration:42s]">
          {[false, true].map((copy) => (
            <ul key={String(copy)} className="marquee-track !gap-14 !pr-14" aria-hidden={copy || undefined}>
              {SHOP_NAMES.map((name) => (
                <li key={name} className="whitespace-nowrap">
                  {name}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
