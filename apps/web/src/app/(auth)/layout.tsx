import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Sparkle } from "@/components/marketing/decor";
import { PHOTOS } from "@/components/marketing/photos";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col p-3 sm:p-5">
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 overflow-hidden rounded-3xl bg-board lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
          <Link href="/" aria-label="Sạp, về trang chủ" className="self-start rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo />
          </Link>
          <main className="flex flex-1 items-center py-10">
            <div className="w-full max-w-md">{children}</div>
          </main>
        </div>

        {/* Photo panel, landing-style: glow, connector, floating cards */}
        <div className="relative hidden border-l border-border lg:block">
          <div className="glow-lime absolute top-[20%] left-[15%] h-96 w-96" aria-hidden />
          <div className="absolute inset-10 overflow-hidden rounded-3xl">
            <Image src={PHOTOS.owner.src} alt={PHOTOS.owner.alt} fill sizes="45vw" className="object-cover" priority />
          </div>
          <div className="absolute bottom-16 left-4 max-w-xs rounded-3xl bg-card p-5 shadow-[0_24px_48px_-24px_rgb(18_20_16/0.4)]">
            <p className="text-sm leading-relaxed">“Mở máy lên là biết hôm qua kênh nào bán tốt, món nào sắp hết để kịp nhập hàng.”</p>
            <p className="mt-3 text-xs text-muted-foreground">Chủ shop thời trang, 2 chi nhánh</p>
          </div>
          <div className="absolute top-16 right-4 flex items-center gap-2 rounded-full bg-card py-1.5 pr-4 pl-1.5 text-sm shadow-[0_12px_24px_-12px_rgb(18_20_16/0.4)]">
            <span className="flex size-7 items-center justify-center rounded-full bg-lime text-xs font-semibold text-lime-foreground">+1</span>
            Đơn mới từ Shopee
          </div>
          <Sparkle className="absolute top-8 left-6" />
        </div>
      </div>
    </div>
  );
}
