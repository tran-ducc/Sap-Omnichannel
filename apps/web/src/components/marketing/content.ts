// Landing page copy & mock data, kept apart from layout so marketing can edit
// text without touching components.

export type ChannelKey = "pos" | "website" | "shopee" | "lazada" | "tiktok" | "facebook";

export const CHANNELS: Record<ChannelKey, { label: string; color: string }> = {
  pos: { label: "Tại quầy", color: "var(--ch-pos)" },
  website: { label: "Website", color: "var(--ch-website)" },
  shopee: { label: "Shopee", color: "var(--ch-shopee)" },
  lazada: { label: "Lazada", color: "var(--ch-lazada)" },
  tiktok: { label: "TikTok Shop", color: "var(--ch-tiktok)" },
  facebook: { label: "Facebook", color: "var(--ch-facebook)" },
};

export const NAV_LINKS = [
  { href: "#tinh-nang", label: "Tính năng" },
  { href: "#phan-quyen", label: "Phân quyền" },
  { href: "#bang-gia", label: "Bảng giá" },
  { href: "#cau-hoi", label: "Câu hỏi" },
];

export const STATS = [
  { value: "1,2 triệu", label: "đơn xử lý mỗi tháng" },
  { value: "6", label: "kênh bán kết nối sẵn" },
  { value: "< 2 giây", label: "để tồn kho khớp mọi kênh" },
  { value: "99,95%", label: "thời gian hoạt động năm 2026" },
];

/** Fictional customers for the social-proof strip. */
export const SHOP_NAMES = [
  "Nhà Gốm Bát Tràng",
  "Linen House",
  "Bếp Mẹ Ỉn",
  "Dép Lào Sài Gòn",
  "Mộc Cosmetics",
  "Trà Đạo Thái Nguyên",
  "Sneaker Hẻm",
];

export const STEPS = [
  {
    title: "Kết nối kênh bán",
    body: "Đăng nhập Shopee, Lazada, TikTok Shop, Facebook trong vài cú nhấp. Sạp tự kéo sản phẩm và đơn đang có về.",
  },
  {
    title: "Gộp sản phẩm về một kho",
    body: "Sạp ghép các listing trùng nhau theo SKU. Mỗi mẫu mã chỉ có một con số tồn kho cho từng chi nhánh.",
  },
  {
    title: "Bán ở đâu cũng được",
    body: "Khách mua ở quầy hay trên sàn, tồn kho đều trừ ngay. Mọi kênh nhận số mới trong chưa đầy 2 giây.",
  },
];

export const ROLE_MATRIX: { label: string; admin: boolean; manager: boolean; staff: boolean }[] = [
  { label: "Bán hàng tại quầy (POS)", admin: true, manager: true, staff: true },
  { label: "Xem đơn hàng được phân công", admin: true, manager: true, staff: true },
  { label: "Xem tồn kho", admin: true, manager: true, staff: true },
  { label: "Sửa giá bán, giảm giá", admin: true, manager: true, staff: false },
  { label: "Nhập, chuyển và kiểm kho", admin: true, manager: true, staff: false },
  { label: "Báo cáo doanh thu chi tiết", admin: true, manager: true, staff: false },
  { label: "Quản lý nhân viên", admin: true, manager: true, staff: false },
  { label: "Cài đặt hệ thống, xoá cửa hàng", admin: true, manager: false, staff: false },
];

export const PLANS = [
  {
    name: "Khởi đầu",
    monthly: 199_000,
    yearly: 159_000,
    description: "Cho cửa hàng một chi nhánh mới bắt đầu bán online.",
    features: ["1 chi nhánh", "2 kênh bán", "3 tài khoản nhân viên", "POS trên máy tính và tablet", "Báo cáo cơ bản"],
    cta: "Dùng thử 14 ngày",
    highlighted: false,
  },
  {
    name: "Tăng trưởng",
    monthly: 499_000,
    yearly: 399_000,
    description: "Cho shop bán trên nhiều sàn và cần đồng bộ tồn kho.",
    features: [
      "3 chi nhánh",
      "Không giới hạn kênh bán",
      "15 tài khoản nhân viên",
      "Đồng bộ tồn kho thời gian thực",
      "CRM và tích điểm",
      "Báo cáo nâng cao, xuất Excel",
    ],
    cta: "Dùng thử 14 ngày",
    highlighted: true,
  },
  {
    name: "Chuỗi",
    monthly: null,
    yearly: null,
    description: "Cho chuỗi cửa hàng cần API, phân quyền theo chi nhánh và hỗ trợ riêng.",
    features: ["Không giới hạn chi nhánh", "Phân quyền theo chi nhánh", "API và webhook", "Người phụ trách riêng", "Cam kết SLA 99,95%"],
    cta: "Liên hệ tư vấn",
    highlighted: false,
  },
];

/** Fictional testimonials. */
export const TESTIMONIALS = [
  {
    quote:
      "Trước đây cuối ngày phải ngồi trừ tay tồn kho Shopee với TikTok, tháng nào cũng bán lố vài chục đơn. Từ khi dùng Sạp thì gần như không còn đơn phải huỷ vì hết hàng.",
    name: "Chị Thu Hà",
    role: "Chủ shop Linen House, 2 chi nhánh",
    metric: "Giảm 94% đơn huỷ vì hết hàng",
  },
  {
    quote:
      "Nhân viên mới học POS chưa tới 15 phút. Tôi yên tâm vì các bạn không sửa được giá và không xem được doanh thu tổng.",
    name: "Anh Minh Quân",
    role: "Quản lý Sneaker Hẻm",
    metric: "Đào tạo thu ngân trong 15 phút",
  },
  {
    quote:
      "Mỗi sáng tôi mở báo cáo trên điện thoại là biết hôm qua kênh nào bán tốt, món nào sắp hết để kịp nhập hàng.",
    name: "Gia Huy",
    role: "Quản lý Bếp Mẹ Ỉn, 4 điểm bán",
    metric: "Tiết kiệm 6 giờ đối soát mỗi tuần",
  },
];

export const FAQS = [
  {
    q: "Tôi có cần mua máy POS riêng không?",
    a: "Không. Sạp chạy trên trình duyệt của máy tính, tablet hoặc điện thoại. Máy in hoá đơn, máy quét mã vạch và két tiền thông dụng đều kết nối được qua USB hoặc Bluetooth.",
  },
  {
    q: "Đồng bộ tồn kho với sàn hoạt động thế nào?",
    a: "Khi có đơn ở bất kỳ kênh nào, Sạp giữ hàng ngay trong kho chung rồi đẩy số tồn mới lên các sàn còn lại. Thường mất chưa đầy 2 giây. Nếu sàn tạm lỗi, Sạp tự thử lại và báo cho bạn.",
  },
  {
    q: "Dữ liệu cũ từ Excel hoặc phần mềm khác có chuyển sang được không?",
    a: "Được. Bạn tải file Excel sản phẩm, khách hàng và tồn kho lên, Sạp tự nhận cột. Gói Tăng trưởng trở lên có nhân viên hỗ trợ chuyển dữ liệu miễn phí.",
  },
  {
    q: "Hết 14 ngày dùng thử thì sao?",
    a: "Bạn chọn gói để tiếp tục, hoặc dừng mà không mất phí. Không cần thẻ ngân hàng khi đăng ký. Dữ liệu được giữ thêm 30 ngày để bạn quyết định.",
  },
  {
    q: "Có xuất hoá đơn điện tử không?",
    a: "Có. Sạp kết nối với các nhà cung cấp hoá đơn điện tử phổ biến để xuất hoá đơn ngay khi đơn hoàn tất.",
  },
];
