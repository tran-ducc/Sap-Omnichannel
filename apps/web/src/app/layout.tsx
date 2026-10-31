import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { SessionProvider } from "@/components/app/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Geometric sans matching both design references, with a Vietnamese subset.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sạp — Quản lý bán hàng đa kênh trên một nền tảng",
    template: "%s | Sạp",
  },
  description:
    "Gom đơn từ quầy, website, Shopee, Lazada, TikTok Shop và Facebook về một nơi. Tồn kho đồng bộ tức thì, POS nhanh, báo cáo rõ ràng.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e4e8df" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${lexend.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
