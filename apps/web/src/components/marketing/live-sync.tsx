import Image from "next/image";
import { Sparkle } from "./decor";
import { PHOTOS } from "./photos";
import { SyncDemo } from "./sync-demo";

/** Board that frames the interactive stock demo with a livestream-selling photo. */
export function LiveSync() {
  return (
    <section aria-labelledby="sync-heading" className="px-3 sm:px-5">
      <div data-reveal className="mx-auto grid max-w-[1400px] gap-10 rounded-3xl bg-board p-3 pt-8 sm:p-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:p-14">
        <div className="flex flex-col px-3 sm:px-0">
          <h2 id="sync-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
            Đang livestream bán hết hàng? Shopee biết ngay.
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed font-light text-muted-foreground">
            Mỗi đơn chốt trên TikTok Shop, ở quầy hay trên website đều trừ vào một kho chung. Các sàn khác nhận số tồn mới trong chưa đầy hai giây, nên không còn
            cảnh bán lố rồi xin lỗi khách.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Bấm “Tạo đơn thử” ở khung bên cạnh để xem tồn kho đồng bộ.</p>

          <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-3xl lg:mt-auto">
            <Image src={PHOTOS.livestream.src} alt={PHOTOS.livestream.alt} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
            <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
              Đang phát trực tiếp, 1.284 người xem
            </span>
          </div>
        </div>

        <div className="relative">
          <Sparkle className="absolute -top-3 -left-6 hidden lg:block" />
          <SyncDemo />
        </div>
      </div>
    </section>
  );
}
