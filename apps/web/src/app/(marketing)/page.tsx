import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingRoles } from "@/components/landing/landing-roles";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingSync } from "@/components/landing/landing-sync";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { ProductPreview } from "@/components/marketing/product-preview";
import { REVEAL_BOOT } from "@/components/marketing/reveal";
import { RevealObserver } from "@/components/marketing/reveal-observer";

/**
 * Landing page, editorial green design (reference: Holganix).
 * The previous design is kept at /landing-cu and in git tag `landing-v1`.
 */
export default function LandingPage() {
  return (
    <div className="bg-cream text-cream-foreground">
      {/* Scroll-reveal motion: see components/marketing/reveal-observer.tsx */}
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      <RevealObserver />
      <a href="#main" className="sr-only z-50 bg-lime px-4 py-2 font-medium text-lime-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Bỏ qua, tới nội dung chính
      </a>
      <LandingHeader />
      <main id="main">
        <LandingHero />
        <LandingFeatures />
        <LandingSync />
        {/* App UI showcase keeps the app's own rounded look on purpose */}
        <div className="bg-cream py-20 lg:py-28">
          <ProductPreview />
        </div>
        <LandingSteps />
        <LandingRoles />
        <LandingPricing />
        <LandingTestimonials />
        <LandingFaq />
      </main>
      <LandingCta />
    </div>
  );
}
