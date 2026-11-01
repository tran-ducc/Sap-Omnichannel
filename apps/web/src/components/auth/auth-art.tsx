"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { PHOTOS } from "@/components/marketing/photos";

/** One retail photo per auth page: counter for login, packing for sign-up, stockroom for password pages. */
const ART: Record<string, { photo: { src: string; alt: string }; caption: string }> = {
  "/login": { photo: PHOTOS.posTablet, caption: "Quầy, website và đơn online, một kho hàng chung" },
  "/register": { photo: PHOTOS.packing, caption: "Dọn sạp lên mạng trong 10 phút" },
  "/forgot-password": { photo: PHOTOS.warehouse, caption: "Kho của bạn vẫn ở đây, chờ bạn quay lại" },
  "/reset-password": { photo: PHOTOS.warehouse, caption: "Kho của bạn vẫn ở đây, chờ bạn quay lại" },
};

/**
 * Arch-topped photo panel with a crosshair drawn over it (reference: "Orion"
 * auth screen; same lens language as the landing hero). Toned green so any
 * retail photo sits in the forest palette.
 */
export function AuthArt() {
  const art = ART[usePathname()] ?? ART["/login"];
  return (
    <figure className="relative h-full min-h-[560px] overflow-hidden rounded-t-[999px] bg-forest">
      <Image key={art.photo.src} src={art.photo.src} alt={art.photo.alt} fill priority sizes="(min-width: 1024px) 45vw, 0px" className="object-cover opacity-80 mix-blend-luminosity" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_45%,transparent,color-mix(in_oklab,var(--forest-deep)_85%,transparent))]" aria-hidden />
      <div className="absolute inset-0 bg-lime/10 mix-blend-soft-light" aria-hidden />

      {/* Crosshair: thin lines that grow in, a faint arc and a lime target square (reference detail). */}
      <span className="auth-line-y absolute top-0 bottom-0 left-[58%] w-px bg-forest-foreground/60" aria-hidden />
      <span className="auth-line-x absolute top-[47%] right-0 left-0 h-px bg-forest-foreground/45 [--draw-delay:450ms]" aria-hidden />
      <svg className="auth-fade absolute inset-0 size-full text-forest-foreground [--draw-delay:700ms]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M100 18 C 55 30, 22 62, 16 100" className="fill-none stroke-current" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".45" />
      </svg>
      <span className="auth-fade absolute top-[44%] left-[calc(58%-14px)] size-7 border border-lime [--draw-delay:1100ms]" aria-hidden />

      <figcaption className="auth-rise absolute right-6 bottom-6 left-6 flex items-center gap-2.5 text-sm text-forest-foreground [--rise-delay:1200ms]">
        <span className="size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
        {art.caption}
      </figcaption>
    </figure>
  );
}
