import { Check, Minus } from "lucide-react";
import { ROLE_MATRIX } from "@/components/marketing/content";
import { revealDelay, revealStagger } from "@/components/marketing/reveal";
import { SectionLabel } from "./bits";

const ROLES = [
  { name: "Admin", body: "Chủ cửa hàng. Toàn quyền với mọi chi nhánh, gói dịch vụ và cài đặt." },
  { name: "Quản lý", body: "Sản phẩm, đơn hàng, tồn kho, báo cáo và nhân viên của chi nhánh mình." },
  { name: "Nhân viên", body: "Bán tại quầy và xử lý những đơn được phân công." },
];

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="mx-auto flex size-7 items-center justify-center rounded-full bg-lime text-lime-foreground">
      <Check className="size-4" aria-label="Có" />
    </span>
  ) : (
    <Minus className="mx-auto size-4 opacity-35" aria-label="Không" />
  );
}

/** Cream section: role summaries as a hairline list, permissions as a ruled table. */
export function LandingRoles() {
  return (
    <section id="phan-quyen" aria-labelledby="roles-heading" className="bg-cream text-cream-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div data-reveal>
            <SectionLabel index="05">Phân quyền</SectionLabel>
            <h2 id="roles-heading" className="mt-10 text-[clamp(2.4rem,4.6vw,4.25rem)] leading-[1.02] font-light tracking-[-0.04em]">
              Mỗi người thấy đúng phần việc của mình
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed font-light text-cream-muted">
              Thu ngân bán hàng mà không sửa được giá. Quản lý điều hành chi nhánh mà không đụng tới cài đặt hệ thống.
            </p>
            <ul data-reveal-stagger className="mt-10 border-t border-cream-foreground/20">
              {ROLES.map((r) => (
                <li key={r.name} className="grid grid-cols-[7rem_1fr] gap-4 border-b border-cream-foreground/20 py-5">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-[15px] font-light text-cream-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal style={revealDelay(150)} className="relative self-end overflow-x-auto">
            <table className="w-full min-w-[480px] text-[15px]">
              <caption className="sr-only">So sánh quyền của ba vai trò</caption>
              <thead>
                <tr className="border-b border-cream-foreground text-xs tracking-[0.14em] uppercase">
                  <th scope="col" className="py-4 pr-4 text-left font-medium opacity-60">
                    Quyền
                  </th>
                  {["Admin", "Quản lý", "Nhân viên"].map((h) => (
                    <th key={h} scope="col" className="w-24 px-2 py-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-reveal-stagger style={revealStagger(50)}>
                {ROLE_MATRIX.map((r) => (
                  <tr key={r.label} className="border-b border-cream-foreground/15 transition-colors hover:bg-cream-foreground/5">
                    <th scope="row" className="py-3.5 pr-4 text-left font-light">
                      {r.label}
                    </th>
                    <td className="px-2 py-3.5 text-center">
                      <Mark on={r.admin} />
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      <Mark on={r.manager} />
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      <Mark on={r.staff} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
