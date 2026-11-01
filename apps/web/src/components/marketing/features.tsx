import Image from "next/image";
import { ArrowUpRight, Barcode, BellRing, FileText, History, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNELS, COPY, type ChannelKey } from "./content";
import { PHOTOS } from "./photos";
import { revealStagger } from "./reveal";

const LOCATIONS = [
  { name: "Kho tổng Thủ Đức", qty: 182, max: 200 },
  { name: "Chi nhánh Quận 1", qty: 24, max: 200 },
  { name: "Chi nhánh Hoàn Kiếm", qty: 4, max: 200, low: true },
];

const INBOX: { ch: ChannelKey; code: string; status: string }[] = [
  { ch: "tiktok", code: "TT-58201", status: "Chờ lấy hàng" },
  { ch: "shopee", code: "SP-77310", status: "Đã xác nhận" },
  { ch: "facebook", code: "FB-1204", status: "Chờ gọi xác nhận" },
  { ch: "website", code: "WEB-0931", status: "Đã thanh toán" },
];

// Deterministic "orders per hour" pattern: lunch and evening peaks, busier weekends.
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const HOURS = [8, 10, 12, 14, 16, 18, 20];
function heat(d: number, h: number) {
  const peak = Math.exp(-((h - 12) ** 2) / 6) + 1.2 * Math.exp(-((h - 19) ** 2) / 5);
  const weekend = d >= 5 ? 1.35 : 1;
  return Math.min(1, ((peak * weekend) / 1.7) * (0.75 + ((d * 7 + h) % 5) / 16));
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xl leading-tight font-normal tracking-[-0.025em]">{children}</h3>;
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-2 text-[15px] leading-relaxed font-light text-muted-foreground", className)}>{children}</p>;
}

export function Features() {
  return (
    <section id="tinh-nang" aria-labelledby="features-heading" className="mx-auto max-w-[1400px] px-3 py-20 sm:px-5 lg:py-28">
      <div data-reveal-stagger className="px-3 sm:px-5 lg:px-9">
        <h2 id="features-heading" className="max-w-3xl text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
          Đủ cho cả cửa hàng, từ quầy thu ngân đến kho
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed font-light text-muted-foreground">
          Mỗi người chỉ thấy phần việc của mình. Chủ shop xem số, quản lý xử lý đơn và kho, thu ngân bán hàng.
        </p>
      </div>

      <div data-reveal-stagger style={revealStagger(110)} className="mt-12 grid gap-3 lg:grid-cols-12">
        {/* Inventory — photo + data, the widest card */}
        <article className="hover-lift grid overflow-hidden rounded-3xl bg-card [--lift:1.01] lg:col-span-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="relative min-h-56">
            <Image src={PHOTOS.warehouse.src} alt={PHOTOS.warehouse.alt} fill sizes="(min-width: 1024px) 30vw, 95vw" className="object-cover" />
          </div>
          <div className="p-6 sm:p-8">
            <Title>Một kho chung cho mọi kênh, mọi chi nhánh</Title>
            <Body>Bán ở đâu trừ ở đó, quầy và đơn online dùng chung một con số tồn. Nhập, chuyển và kiểm kho đều có lịch sử.</Body>
            <ul className="mt-6 space-y-4" aria-label="Ví dụ tồn kho theo chi nhánh">
              {LOCATIONS.map((l) => (
                <li key={l.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{l.name}</span>
                    <span className="flex items-center gap-2">
                      {l.low && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber-ink">Dưới mức tối thiểu</span>}
                      <span className="font-medium tabular">{l.qty}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-muted" aria-hidden>
                    <div className={cn("h-full rounded-full", l.low ? "bg-amber" : "bg-ink")} style={{ width: `${Math.max(4, (l.qty / l.max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Orders inbox — lime card with notch, like the app reference */}
        <article className="hover-lift relative rounded-3xl bg-lime p-6 text-lime-foreground sm:p-8 lg:col-span-4" style={{ ["--notch-bg" as string]: "var(--background)" }}>
          <div className="notch">
            <span className="flex size-12 items-center justify-center rounded-full bg-card text-foreground">
              <ArrowUpRight className="size-5" aria-hidden />
            </span>
          </div>
          <div className="pr-16">
            <Title>{COPY.inbox.title}</Title>
          </div>
          <Body className="text-lime-foreground/70">{COPY.inbox.body}</Body>
          <ul className="mt-6 space-y-2" aria-label="Ví dụ hộp đơn">
            {INBOX.map((o) => (
              <li key={o.code} className="flex items-center gap-2.5 rounded-full bg-card/80 px-4 py-2.5 text-sm text-foreground">
                <span className="size-2 rounded-full" style={{ background: CHANNELS[o.ch].color }} aria-hidden />
                <span className="font-medium tabular">{o.code}</span>
                <span className="sr-only">{CHANNELS[o.ch].label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{o.status}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* POS with photo */}
        <article className="hover-lift overflow-hidden rounded-3xl bg-card lg:col-span-4">
          <div className="relative h-52">
            <Image src={PHOTOS.posTablet.src} alt={PHOTOS.posTablet.alt} fill sizes="(min-width: 1024px) 30vw, 95vw" className="object-cover" />
            <span className="absolute bottom-4 left-4 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium tabular">685.000₫, chuyển khoản QR</span>
          </div>
          <div className="p-6 sm:p-8">
            <Title>POS tính tiền trong ba chạm</Title>
            <Body>Quét mã, chọn cách thanh toán, in hoá đơn. Chạy trên tablet, vẫn bán tiếp khi rớt mạng.</Body>
          </div>
        </article>

        {/* Analytics — always-dark card like "Efficiency" */}
        <article className="hover-lift rounded-3xl bg-night p-6 text-night-foreground sm:p-8 lg:col-span-4">
          <Title>Biết giờ nào đông khách</Title>
          <Body className="text-night-foreground/65">Doanh thu theo kênh, theo giờ, theo nhân viên để xếp ca và nhập hàng.</Body>
          <figure className="mt-6">
            <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 text-[11px] text-night-foreground/60" aria-hidden>
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center tabular">
                  {h}h
                </span>
              ))}
              {DAYS.map((d, di) => (
                <div key={d} className="contents">
                  <span className="pr-1 leading-5">{d}</span>
                  {HOURS.map((h) => (
                    <span key={h} className="h-5 rounded-full bg-lime" style={{ opacity: 0.1 + heat(di, h) * 0.9 }} />
                  ))}
                </div>
              ))}
            </div>
            <figcaption className="sr-only">Biểu đồ nhiệt số đơn theo giờ: cao điểm buổi trưa và 18 đến 20 giờ, cuối tuần đông hơn.</figcaption>
          </figure>
        </article>

        {/* Multi-branch with photo */}
        <article className="hover-lift relative min-h-80 overflow-hidden rounded-3xl lg:col-span-4">
          <Image src={PHOTOS.boutique.src} alt={PHOTOS.boutique.alt} fill sizes="(min-width: 1024px) 30vw, 95vw" className="object-cover" />
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-card/95 p-5">
            <Title>Nhiều chi nhánh, một nơi quản lý</Title>
            <Body className="mt-1">Xem tồn và doanh thu từng cửa hàng, chuyển hàng giữa các chi nhánh.</Body>
          </div>
        </article>
      </div>

      <ul data-reveal-stagger style={revealStagger(60)} className="mt-8 flex flex-wrap gap-2 px-3 sm:px-5 lg:px-9">
        {[
          { icon: Store, label: "Khách quen và tích điểm" },
          { icon: Barcode, label: "In tem mã vạch hàng loạt" },
          { icon: FileText, label: "Hoá đơn điện tử" },
          { icon: BellRing, label: "Báo khi hàng sắp hết" },
          { icon: History, label: "Nhật ký thao tác nhân viên" },
        ].map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm">
            <Icon className="size-4" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
