import Image from "next/image";
import { Barcode, BellRing, Boxes, ChartColumn, Inbox, Store, type LucideIcon } from "lucide-react";
import { COPY } from "@/components/marketing/content";
import { PHOTOS } from "@/components/marketing/photos";
import { revealStagger } from "@/components/marketing/reveal";
import { SectionLabel } from "./bits";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Boxes, title: "Một kho chung cho mọi kênh", body: "Bán ở đâu trừ ở đó, quầy và đơn online dùng chung một con số tồn. Nhập, chuyển, kiểm kho đều có lịch sử." },
  { icon: Inbox, title: COPY.inbox.title, body: COPY.inbox.body },
  { icon: Barcode, title: "POS ba chạm", body: "Quét mã, chọn cách thanh toán, in hoá đơn 80mm. Chạy trên tablet ngay tại quầy." },
  { icon: ChartColumn, title: "Biết giờ nào đông khách", body: "Doanh thu theo kênh, theo giờ, theo nhân viên để xếp ca và nhập hàng cho đúng." },
  { icon: Store, title: "Nhiều chi nhánh, một nơi", body: "Xem tồn và doanh thu từng cửa hàng, chuyển hàng giữa các chi nhánh trong vài giây." },
  { icon: BellRing, title: "Báo khi cần chú ý", body: "Hàng sắp hết, đơn online mới, lệch tiền cuối ca: thông báo đến đúng người, ngay lúc đó." },
];

/** Cream editorial grid: hairline cells with big index numbers, flanked by two photo tiles. */
export function LandingFeatures() {
  return (
    <section id="tinh-nang" aria-labelledby="features-heading" className="bg-cream text-cream-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div data-reveal className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionLabel index="01">Tính năng</SectionLabel>
          <div>
            <h2 id="features-heading" className="text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
              Đủ cho cả cửa hàng, từ quầy thu ngân đến kho
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed font-light text-cream-muted">
              Mỗi người chỉ thấy phần việc của mình. Chủ shop xem số, quản lý xử lý đơn và kho, thu ngân bán hàng.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-px bg-cream-foreground/15 lg:grid-cols-[0.9fr_2fr]">
          <div className="relative min-h-80 bg-cream">
            <Image src={PHOTOS.posTablet.src} alt={PHOTOS.posTablet.alt} fill sizes="(min-width: 1024px) 30vw, 95vw" className="object-cover" />
            <span className="absolute bottom-0 left-0 bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground tabular">685.000₫, chuyển khoản QR</span>
          </div>
          <ul data-reveal-stagger style={revealStagger(80)} className="grid gap-px bg-cream-foreground/15 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="group flex min-h-64 flex-col bg-cream p-6 transition-colors duration-500 hover:bg-forest hover:text-forest-foreground sm:p-8">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-light tabular opacity-60">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="size-5 opacity-70 transition-colors group-hover:text-lime group-hover:opacity-100" aria-hidden />
                </div>
                <h3 className="mt-auto pt-10 text-2xl leading-tight font-light tracking-[-0.025em]">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed font-light text-cream-muted transition-colors group-hover:text-forest-foreground/70">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
