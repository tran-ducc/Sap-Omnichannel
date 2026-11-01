import Image from "next/image";
import { PHOTOS } from "@/components/marketing/photos";
import { revealDelay } from "@/components/marketing/reveal";
import { SyncDemo } from "@/components/marketing/sync-demo";
import { SectionLabel } from "./bits";

/** Forest band around the live stock demo (the interactive SyncDemo is reused as is). */
export function LandingSync() {
  return (
    <section aria-labelledby="sync-heading" className="relative overflow-hidden bg-forest text-forest-foreground">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:px-12 lg:py-32">
        <div data-reveal className="flex flex-col">
          <SectionLabel index="02">Đồng bộ tồn kho</SectionLabel>
          <h2 id="sync-heading" className="mt-10 text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
            Đang livestream bán hết hàng? Shopee biết ngay.
          </h2>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed font-light text-forest-foreground/75">
            Mỗi đơn chốt trên TikTok Shop, ở quầy hay trên website đều trừ vào một kho chung. Các sàn khác nhận số tồn mới trong chưa đầy hai giây.
          </p>
          <p className="mt-4 text-sm text-forest-foreground/60">Bấm “Tạo đơn thử” ở khung bên cạnh để xem tồn kho đồng bộ.</p>
          <div className="relative mt-12 aspect-[16/10] overflow-hidden lg:mt-auto">
            <Image src={PHOTOS.livestream.src} alt={PHOTOS.livestream.alt} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
            <span className="absolute top-0 left-0 inline-flex items-center gap-2 bg-forest-deep/85 px-3.5 py-2 text-xs font-medium tracking-[0.1em] uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-lime" aria-hidden />
              Đang phát trực tiếp, 1.284 người xem
            </span>
          </div>
        </div>
        <div data-reveal style={revealDelay(200)} className="relative self-center text-foreground">
          <span className="absolute -top-4 -right-2 bottom-8 hidden w-1 bg-lime lg:block" aria-hidden />
          <SyncDemo />
        </div>
      </div>
    </section>
  );
}
