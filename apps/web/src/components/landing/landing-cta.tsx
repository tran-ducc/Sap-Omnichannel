import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { COPY } from "@/components/marketing/content";
import { PHOTOS } from "@/components/marketing/photos";
import { revealDelay } from "@/components/marketing/reveal";
import { LensFrame, RoundCta } from "./bits";

const FOOTER_LINKS = [
  { title: "Sản phẩm", links: [["Bán tại quầy (POS)", "#demo"], ["Đơn hàng đa kênh", "#tinh-nang"], ["Quản lý tồn kho", "#tinh-nang"], ["Bảng giá", "#bang-gia"]] },
  { title: "Hỗ trợ", links: [["Trung tâm trợ giúp", "#"], ["Hướng dẫn nhập đơn online", "#"], ["Tài liệu API", "#"], ["Trạng thái hệ thống", "#"]] },
  { title: "Công ty", links: [["Về chúng tôi", "#"], ["Tuyển dụng", "#"], ["Liên hệ", "#lien-he"]] },
] as const;

/** Closing CTA on a toned photo, followed by the page footer in the same forest tone. */
export function LandingCta() {
  return (
    <>
      <section id="lien-he" aria-labelledby="cta-heading" className="relative isolate overflow-hidden bg-forest-deep text-forest-foreground">
        <Image src={PHOTOS.boutique.src} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-30 mix-blend-luminosity" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_90%_at_80%_30%,color-mix(in_oklab,var(--forest)_60%,transparent),var(--forest-deep)_80%)]" aria-hidden />
        <div className="mx-auto grid max-w-[1440px] items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:px-12 lg:py-36">
          <div data-reveal>
            <h2 id="cta-heading" className="text-[clamp(2.8rem,6vw,5.75rem)] leading-[0.98] font-light tracking-[-0.045em]">
              Dọn sạp lên mạng
              <br />
              trong 10 phút
            </h2>
            <p className="mt-7 max-w-md text-[17px] leading-relaxed font-light text-forest-foreground/75">
              {COPY.ctaBody}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/register" className="flex h-12 items-center bg-lime px-6 text-sm font-medium text-lime-foreground transition-colors hover:bg-lime/85">
                Tạo cửa hàng miễn phí
              </Link>
              <a href="tel:19000000" className="inline-flex items-center gap-2.5 text-sm font-medium">
                <span className="flex size-10 items-center justify-center rounded-full border border-forest-foreground/50">
                  <Phone className="size-4" aria-hidden />
                </span>
                Gọi 1900 0000
              </a>
            </div>
          </div>
          <div data-reveal style={revealDelay(200)} className="relative mx-auto aspect-square w-full max-w-[20rem]">
            <LensFrame className="absolute inset-0 size-full text-forest-foreground" />
            <div className="absolute inset-[17%] overflow-hidden rounded-full">
              <Image src={PHOTOS.cardPayment.src} alt={PHOTOS.cardPayment.alt} fill sizes="220px" className="object-cover" />
            </div>
            <RoundCta href="/register" className="absolute -right-2 -bottom-6">
              Bắt đầu
            </RoundCta>
          </div>
        </div>
      </section>

      <footer className="border-t border-forest-foreground/15 bg-forest-deep text-forest-foreground">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.3fr_2fr] lg:px-12">
          <div>
            <Logo onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed font-light text-forest-foreground/65">
              Phần mềm quản lý bán hàng đa kênh cho cửa hàng Việt: quầy, website, sàn thương mại điện tử và mạng xã hội.
            </p>
          </div>
          <nav aria-label="Liên kết chân trang" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-medium tracking-[0.14em] uppercase opacity-60">{col.title}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="opacity-85 transition-opacity hover:opacity-100 hover:underline hover:underline-offset-4">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3 border-t border-forest-foreground/10 px-5 py-6 text-xs text-forest-foreground/55 sm:px-8 lg:px-12">
          <span>© 2026 Sạp. Ảnh minh hoạ từ Unsplash.</span>
          <span>Hotline 1900 0000, hotro@sap.vn</span>
        </div>
      </footer>
    </>
  );
}
