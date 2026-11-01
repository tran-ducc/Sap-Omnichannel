import Image from "next/image";
import { TESTIMONIALS } from "@/components/marketing/content";
import { PHOTOS } from "@/components/marketing/photos";
import { revealStagger } from "@/components/marketing/reveal";
import { SectionLabel } from "./bits";

const PORTRAITS = [PHOTOS.personHa, PHOTOS.personQuan, PHOTOS.personHuy];

/** Cream section: one big pull-quote, then three short testimonials in hairline columns. */
export function LandingTestimonials() {
  const [lead, ...rest] = TESTIMONIALS;
  return (
    <section aria-labelledby="testimonials-heading" className="bg-cream text-cream-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div data-reveal className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <SectionLabel index="07">Khách hàng nói</SectionLabel>
            <h2 id="testimonials-heading" className="sr-only">
              Nhận xét của khách hàng
            </h2>
            <div className="relative mt-10 aspect-[4/5] max-w-sm overflow-hidden">
              <Image src={PORTRAITS[0].src} alt={PORTRAITS[0].alt} fill sizes="(min-width: 1024px) 24rem, 90vw" className="object-cover" />
              <span className="absolute top-0 right-0 h-full w-1 bg-lime" aria-hidden />
            </div>
          </div>
          <figure className="self-end">
            <blockquote className="text-[clamp(1.8rem,3.2vw,3rem)] leading-[1.15] font-light tracking-[-0.03em]">“{lead.quote}”</blockquote>
            <figcaption className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-cream-foreground/20 pt-5 text-sm">
              <span className="font-medium">{lead.name}</span>
              <span className="text-cream-muted">{lead.role}</span>
              <span className="bg-lime px-3 py-1 font-medium text-lime-foreground">{lead.metric}</span>
            </figcaption>
          </figure>
        </div>

        <ul data-reveal-stagger style={revealStagger(130)} className="mt-20 grid gap-px bg-cream-foreground/15 md:grid-cols-2">
          {rest.map((t, i) => (
            <li key={t.name} className="flex gap-5 bg-cream py-8 md:px-8 md:first:pl-0">
              <div className="relative size-16 shrink-0 overflow-hidden bg-lime">
                <Image src={PORTRAITS[i + 1].src} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <figure>
                <blockquote className="text-[17px] leading-relaxed font-light">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-cream-muted">, {t.role}</span>
                  <span className="mt-1 block text-xs font-medium tracking-[0.1em] uppercase opacity-70">{t.metric}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
