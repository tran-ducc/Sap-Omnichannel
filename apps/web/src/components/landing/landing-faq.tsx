import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQS } from "@/components/marketing/content";
import { revealStagger } from "@/components/marketing/reveal";
import { SectionLabel } from "./bits";

/** Ruled accordion on cream, separated from the testimonials by a hairline. */
export function LandingFaq() {
  return (
    <section id="cau-hoi" aria-labelledby="faq-heading" className="border-t border-cream-foreground/15 bg-cream text-cream-foreground">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-12 lg:py-32">
        <div data-reveal>
          <SectionLabel index="08">Câu hỏi</SectionLabel>
          <h2 id="faq-heading" className="mt-10 text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
            Câu hỏi thường gặp
          </h2>
          <p className="mt-6 text-[17px] leading-relaxed font-light text-cream-muted">
            Chưa thấy câu trả lời bạn cần?{" "}
            <a href="#lien-he" className="font-medium text-cream-foreground underline underline-offset-4">
              Nói chuyện với tư vấn viên
            </a>
            .
          </p>
        </div>
        <Accordion data-reveal-stagger style={revealStagger(70)} className="border-t border-cream-foreground">
          {FAQS.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="border-b border-cream-foreground/20">
              <AccordionTrigger className="cursor-pointer py-6 text-lg font-light hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-6 text-[15px] leading-relaxed font-light text-cream-muted">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
