import Image from "next/image";
import { STEPS } from "@/components/marketing/content";
import { PHOTOS } from "@/components/marketing/photos";
import { revealStagger } from "@/components/marketing/reveal";
import { SectionLabel } from "./bits";

/** Three onboarding steps as columns split by vertical hairlines, on a toned photo. */
export function LandingSteps() {
  return (
    <section aria-labelledby="steps-heading" className="relative isolate overflow-hidden bg-forest-deep text-forest-foreground">
      <Image src={PHOTOS.counter.src} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-25 mix-blend-luminosity" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-forest-deep/60 via-forest-deep/80 to-forest-deep" aria-hidden />
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div data-reveal className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionLabel index="04">Bắt đầu</SectionLabel>
          <h2 id="steps-heading" className="text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
            Bắt đầu bán trong buổi chiều nay
          </h2>
        </div>
        <ol data-reveal-stagger style={revealStagger(140)} className="mt-20 grid border-forest-foreground/20 md:grid-cols-3 md:border-l">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-forest-foreground/20 py-8 md:border-t-0 md:border-r md:px-8 md:py-0">
              <span className={i === 0 ? "text-[clamp(4rem,8vw,7rem)] leading-none font-light tracking-[-0.05em] text-lime tabular" : "text-[clamp(4rem,8vw,7rem)] leading-none font-light tracking-[-0.05em] tabular opacity-90"}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-8 text-2xl font-light tracking-[-0.02em]">{s.title}</h3>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed font-light text-forest-foreground/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
