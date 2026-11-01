import Link from "next/link";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Sản phẩm",
    links: [
      { label: "Bán tại quầy (POS)", href: "#demo" },
      { label: "Đơn hàng đa kênh", href: "#tinh-nang" },
      { label: "Quản lý tồn kho", href: "#tinh-nang" },
      { label: "Báo cáo", href: "#tinh-nang" },
      { label: "Bảng giá", href: "#bang-gia" },
    ],
  },
  {
    title: "Ngành hàng",
    links: [
      { label: "Thời trang", href: "#" },
      { label: "Mỹ phẩm", href: "#" },
      { label: "Đồ ăn, thức uống", href: "#" },
      { label: "Tạp hoá, mini mart", href: "#" },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Trung tâm trợ giúp", href: "#" },
      { label: "Hướng dẫn nhập đơn online", href: "#" },
      { label: "Tài liệu API", href: "#" },
      { label: "Trạng thái hệ thống", href: "#" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { label: "Về chúng tôi", href: "#" },
      { label: "Tuyển dụng", href: "#" },
      { label: "Liên hệ", href: "#lien-he" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[1400px] rounded-3xl bg-board px-6 py-14 sm:px-10 lg:px-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed font-light text-muted-foreground">
              Phần mềm quản lý bán hàng đa kênh cho cửa hàng Việt: quầy, website, sàn thương mại điện tử và mạng xã hội.
            </p>
            <dl className="mt-6 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Hotline</dt>
                <dd>
                  <a href="tel:19000000" className="font-semibold hover:text-primary">
                    1900 0000
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Giờ hỗ trợ</dt>
                <dd>8:00 đến 22:00, cả cuối tuần</dd>
              </div>
            </dl>
          </div>
          <nav aria-label="Liên kết chân trang" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-medium">{col.title}</h3>
                <ul className="mt-4 space-y-3 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sạp. Bảo lưu mọi quyền. Ảnh minh hoạ từ Unsplash.</p>
          <ul className="flex gap-6">
            <li>
              <Link href="#" className="hover:text-foreground">
                Điều khoản sử dụng
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-foreground">
                Chính sách bảo mật
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
