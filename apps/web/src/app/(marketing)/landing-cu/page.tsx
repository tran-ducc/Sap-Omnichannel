import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { LiveSync } from "@/components/marketing/live-sync";
import { Pricing } from "@/components/marketing/pricing";
import { ProductPreview } from "@/components/marketing/product-preview";
import { REVEAL_BOOT } from "@/components/marketing/reveal";
import { RevealObserver } from "@/components/marketing/reveal-observer";
import { Roles } from "@/components/marketing/roles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SocialProof } from "@/components/marketing/social-proof";
import { Steps } from "@/components/marketing/steps";
import { Testimonials } from "@/components/marketing/testimonials";

/**
 * Backup of the previous landing page (Payarc-style, before the 2026-10-31 redesign).
 * Restore: point app/(marketing)/page.tsx back at these components/marketing sections.
 */
export const metadata: Metadata = { title: "Landing cũ (bản sao lưu)", robots: { index: false } };

export default function OldLandingPage() {
  return (
    <>
      {/* Scroll-reveal motion: see components/marketing/reveal-observer.tsx */}
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      <RevealObserver />
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua, tới nội dung chính
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <SocialProof />
        <LiveSync />
        <Features />
        <ProductPreview />
        <Steps />
        <Roles />
        <Pricing />
        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
