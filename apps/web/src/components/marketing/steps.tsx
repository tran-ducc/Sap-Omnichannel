import Image from "next/image";
import { STEPS } from "./content";
import { Sparkle } from "./decor";
import { PHOTOS } from "./photos";
import { revealStagger } from "./reveal";

/** Onboarding is a real sequence, so numbered markers are earned here. */
export function Steps() {
  return (
    <section aria-labelledby="steps-heading" className="mx-auto max-w-[1400px] px-3 py-20 sm:px-5 lg:py-28">
      <div className="grid gap-10 px-3 sm:px-5 lg:grid-cols-[1fr_1.5fr] lg:gap-16 lg:px-9">
        <div data-reveal>
          <h2 id="steps-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
            Bắt đầu bán trong buổi chiều nay
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed font-light text-muted-foreground">
            Phần lớn cửa hàng chạy được đơn đầu tiên trên Sạp trong chưa đầy một giờ.
          </p>
          <div className="relative mt-10 aspect-[5/4] max-w-md overflow-hidden rounded-3xl">
            <Image src={PHOTOS.cardPayment.src} alt={PHOTOS.cardPayment.alt} fill sizes="(min-width: 1024px) 28rem, 90vw" className="object-cover" />
          </div>
        </div>

        <ol data-reveal-stagger style={revealStagger(140)} className="relative self-center">
          {/* vertical connector with star nodes */}
          <span className="absolute top-2 bottom-2 left-[19px] w-px bg-foreground/40" aria-hidden />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[40px_1fr] gap-6 pb-12 last:pb-0">
              <span
                className={
                  i === 0
                    ? "z-10 flex size-10 items-center justify-center rounded-full bg-lime text-sm font-medium text-lime-foreground tabular"
                    : "z-10 flex size-10 items-center justify-center rounded-full bg-card text-sm font-medium tabular"
                }
              >
                {i + 1}
              </span>
              <div className="hover-lift rounded-3xl bg-card p-6">
                <h3 className="text-xl font-normal tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed font-light text-muted-foreground">{s.body}</p>
              </div>
              {i < STEPS.length - 1 && <Sparkle className="absolute bottom-4 left-[13px] size-3.5" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
