import { revealDelay } from "./reveal";
import { SHOP_NAMES, STATS } from "./content";

export function SocialProof() {
  return (
    <section aria-labelledby="proof-heading" className="mx-auto max-w-[1400px] px-6 py-14 sm:px-10 lg:px-14">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
        <h2 id="proof-heading" data-reveal className="text-base font-normal text-muted-foreground">
          Cửa hàng thời trang, mỹ phẩm, F&amp;B và tạp hoá đang bán mỗi ngày trên Sạp
        </h2>
        {/* Marquee: the second track is a visual copy for a seamless loop. Speed: --marquee-duration */}
        <div data-reveal style={revealDelay(120)} className="marquee min-w-0 [--marquee-duration:36s]">
          {[false, true].map((copy) => (
            <ul key={String(copy)} className="marquee-track" aria-hidden={copy || undefined}>
              {SHOP_NAMES.map((name) => (
                <li key={name} className="text-[15px] font-medium tracking-tight whitespace-nowrap">
                  {name}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <dl data-reveal-stagger className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s, i) => (
          // flex-col-reverse: value shows first, but dt still precedes dd in the markup
          <div key={s.label} className={i === 0 ? "hover-lift flex flex-col-reverse rounded-3xl bg-lime p-5 text-lime-foreground" : "hover-lift flex flex-col-reverse rounded-3xl bg-board p-5"}>
            <dt className={i === 0 ? "mt-1 text-sm opacity-75" : "mt-1 text-sm text-muted-foreground"}>{s.label}</dt>
            <dd className="text-3xl font-light tracking-[-0.03em] tabular">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
