import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQS } from "./content";

export function Faq() {
  return (
    <section id="cau-hoi" aria-labelledby="faq-heading" className="mx-auto max-w-[1400px] px-6 py-20 sm:px-10 lg:px-14 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <h2 id="faq-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
            Câu hỏi thường gặp
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed font-light text-muted-foreground">
            Chưa thấy câu trả lời bạn cần?{" "}
            <a href="#lien-he" className="font-medium text-foreground underline underline-offset-4">
              Nói chuyện với tư vấn viên
            </a>
            .
          </p>
        </div>
        <Accordion className="gap-2">
          {FAQS.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="rounded-3xl bg-card px-6 not-last:border-b-0">
              <AccordionTrigger className="cursor-pointer py-5 text-base font-normal hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed font-light text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
