import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COPY } from "./content";
import { PHOTOS } from "./photos";
import { revealStagger } from "./reveal";

const BARS = [46, 22, 64, 30, 88, 40, 70, 26, 58];

export function CtaBand() {
  return (
    <section id="lien-he" aria-labelledby="cta-heading" className="px-3 pb-20 sm:px-5 lg:pb-28">
      <div data-reveal-stagger style={revealStagger(150)} className="mx-auto grid max-w-[1400px] gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative grid gap-8 overflow-hidden rounded-3xl bg-card p-6 sm:p-10 md:grid-cols-[0.9fr_1.2fr] md:items-center lg:p-12">
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <LogoMark className="size-6" /> Sạp
            </span>
            <div className="mt-8 flex h-36 items-end gap-3" aria-hidden>
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className="w-2.5 rounded-full"
                  style={{ height: `${h}%`, background: "linear-gradient(to top, var(--lime) 0%, color-mix(in oklab, var(--lime) 15%, transparent) 100%)" }}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 id="cta-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
              Dọn sạp lên mạng trong 10 phút
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed font-light text-muted-foreground">
              {COPY.ctaBody}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/register" className={buttonVariants({ size: "xl" })}>
                Tạo cửa hàng miễn phí
              </Link>
              <a href="tel:19000000" className="inline-flex items-center gap-2.5 text-[15px] font-medium">
                <span className="flex size-9 items-center justify-center rounded-full border border-foreground/70">
                  <Phone className="size-3.5" aria-hidden />
                </span>
                Gọi 1900 0000
              </a>
            </div>
          </div>
        </div>

        <div className="relative min-h-72 overflow-hidden rounded-3xl">
          <Image src={PHOTOS.counter.src} alt={PHOTOS.counter.alt} fill sizes="(min-width: 1024px) 35vw, 95vw" className="object-cover" />
          <p className={cn("absolute right-4 bottom-4 left-4 rounded-2xl bg-card/95 p-4 text-sm leading-relaxed")}>
            Tư vấn viên hỗ trợ chuyển dữ liệu và cài đặt máy in, máy quét tại cửa hàng của bạn.
          </p>
        </div>
      </div>
    </section>
  );
}
