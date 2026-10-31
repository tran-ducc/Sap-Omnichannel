import Image from "next/image";
import { Barcode, Sparkle } from "./decor";
import { TESTIMONIALS } from "./content";
import { PHOTOS } from "./photos";

const PORTRAITS = [PHOTOS.personHa, PHOTOS.personQuan, PHOTOS.personHuy];

/** Staff-badge card with a lanyard strap — the landing reference's ID-card motif. */
function BadgeCard({ index }: { index: number }) {
  const t = TESTIMONIALS[index];
  const photo = PORTRAITS[index];
  return (
    <li className="relative pt-10">
      {/* lanyard */}
      <span
        className="absolute top-0 left-1/2 h-14 w-7 -translate-x-1/2 rounded-b-sm"
        style={{ background: "repeating-linear-gradient(to bottom, var(--lime) 0 3px, color-mix(in oklab, var(--lime) 70%, var(--amber)) 3px 6px)" }}
        aria-hidden
      />
      <span className="absolute top-12 left-1/2 h-3 w-14 -translate-x-1/2 rounded-full bg-foreground/80" aria-hidden />
      <figure className="flex h-full flex-col rounded-3xl bg-card p-5">
        <div className="relative mt-4 flex items-start justify-between gap-4 border-b border-foreground/80 pb-3">
          <figcaption className="text-[15px] leading-snug font-medium whitespace-nowrap">{t.name}</figcaption>
          <span className="max-w-[9rem] text-right text-xs leading-snug text-muted-foreground">{t.role}</span>
          <Sparkle className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2" />
        </div>
        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 28vw, 90vw" className="object-cover" />
        </div>
        <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed font-light">“{t.quote}”</blockquote>
        <p className="mt-4 inline-flex self-start rounded-full bg-lime px-3 py-1 text-sm font-medium text-lime-foreground">{t.metric}</p>
      </figure>
    </li>
  );
}

export function Testimonials() {
  return (
    <section aria-labelledby="testimonials-heading" className="mx-auto max-w-[1400px] px-3 py-20 sm:px-5 lg:py-28">
      <div className="grid gap-10 px-3 sm:px-5 lg:grid-cols-[1fr_2.2fr] lg:gap-6 lg:px-0">
        {/* Receipt / ticket card */}
        <div className="flex flex-col overflow-hidden rounded-3xl bg-board">
          <div className="p-6 sm:p-7">
            <div className="flex items-center justify-between border-b border-foreground/80 pb-4 text-sm">
              <span className="font-semibold">Sạp</span>
              <span className="text-muted-foreground">Tháng 10/2026</span>
            </div>
            <h2 id="testimonials-heading" className="mt-6 text-4xl leading-[1.08] font-normal tracking-[-0.035em]">
              Linen House sau ba tháng dùng Sạp.
            </h2>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ["Đơn huỷ vì hết hàng", "−94%"],
                ["Thời gian đối soát mỗi tuần", "−6 giờ"],
                ["Doanh thu từ TikTok Shop", "+38%"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-foreground/20 pb-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-lg font-medium tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* perforation + barcode stub */}
          <div className="relative mt-auto border-t-2 border-dashed border-background bg-lime-soft px-6 pt-5 pb-4">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background" aria-hidden />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background" aria-hidden />
            <Barcode />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>Số liệu minh hoạ</span>
              <span className="tabular">HD-2026-10-LH</span>
            </div>
          </div>
        </div>

        <ul className="grid gap-6 md:grid-cols-3 md:gap-4">
          {TESTIMONIALS.map((t, i) => (
            <BadgeCard key={t.name} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
