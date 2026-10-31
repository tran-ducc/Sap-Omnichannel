import Image from "next/image";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_MATRIX } from "./content";
import { PHOTOS } from "./photos";

function Cell({ allowed, className }: { allowed: boolean; className?: string }) {
  return (
    <td className={cn("px-2 py-3 text-center", className)}>
      {allowed ? (
        <span className="mx-auto flex size-7 items-center justify-center rounded-full bg-lime text-lime-foreground">
          <Check className="size-4" aria-label="Có" />
        </span>
      ) : (
        <Minus className="mx-auto size-4 opacity-35" aria-label="Không" />
      )}
    </td>
  );
}

const ROLES = [
  { name: "Admin", body: "Chủ cửa hàng. Toàn quyền với mọi chi nhánh, gói dịch vụ và cài đặt." },
  { name: "Quản lý", body: "Sản phẩm, đơn hàng, tồn kho, báo cáo và nhân viên của chi nhánh mình." },
  { name: "Nhân viên", body: "Bán tại quầy và xử lý những đơn được phân công." },
];

export function Roles() {
  return (
    <section id="phan-quyen" aria-labelledby="roles-heading" className="px-3 sm:px-5">
      <div className="mx-auto grid max-w-[1400px] gap-10 rounded-3xl bg-night p-6 text-night-foreground sm:p-10 lg:grid-cols-[1fr_1.25fr] lg:gap-16 lg:p-14">
        <div className="flex flex-col">
          <h2 id="roles-heading" className="text-4xl leading-[1.08] font-normal tracking-[-0.035em] sm:text-5xl">
            Mỗi người thấy đúng phần việc của mình
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed font-light opacity-70">
            Thu ngân bán hàng mà không sửa được giá. Quản lý điều hành chi nhánh mà không đụng tới cài đặt hệ thống.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-[180px_1fr] lg:mt-auto">
            <div className="relative aspect-square overflow-hidden rounded-3xl sm:aspect-auto">
              <Image src={PHOTOS.counter.src} alt={PHOTOS.counter.alt} fill sizes="180px" className="object-cover" />
            </div>
            <ul className="space-y-2">
              {ROLES.map((r) => (
                <li key={r.name} className="rounded-2xl bg-night-foreground/8 p-4">
                  <p className="font-medium">{r.name}</p>
                  <p className="mt-0.5 text-sm font-light opacity-65">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative overflow-x-auto rounded-3xl bg-card p-2 text-card-foreground">
          <table className="w-full min-w-[460px] text-[15px]">
            <caption className="sr-only">So sánh quyền của ba vai trò</caption>
            <thead>
              <tr className="text-sm">
                <th scope="col" className="px-4 py-4 text-left font-normal text-muted-foreground">
                  Quyền
                </th>
                {["Admin", "Quản lý", "Nhân viên"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map((r, i) => (
                <tr key={r.label} className={i % 2 === 0 ? "bg-muted/70" : ""}>
                  <th scope="row" className="rounded-l-full px-4 py-3 text-left font-light">
                    {r.label}
                  </th>
                  <Cell allowed={r.admin} />
                  <Cell allowed={r.manager} />
                  <Cell allowed={r.staff} className="rounded-r-full" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
