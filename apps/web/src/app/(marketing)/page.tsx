import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { LiveSync } from "@/components/marketing/live-sync";
import { Pricing } from "@/components/marketing/pricing";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Roles } from "@/components/marketing/roles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SocialProof } from "@/components/marketing/social-proof";
import { Steps } from "@/components/marketing/steps";
import { Testimonials } from "@/components/marketing/testimonials";

export default function LandingPage() {
  return (
    <>
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
