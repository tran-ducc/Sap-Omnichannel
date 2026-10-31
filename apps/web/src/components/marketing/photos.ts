/**
 * Placeholder photography from Unsplash (free licence, hot-linked through
 * next/image). Swap for the shop's own photos before going live — the
 * people pictured are not real customers.
 */
const u = (id: string) => `https://images.unsplash.com/${id}`;

export const PHOTOS = {
  owner: { src: u("photo-1753161618091-b4cf35b9aa99"), alt: "Chủ cửa hàng thời trang cầm máy tính bảng giữa các giá treo quần áo" },
  posTablet: { src: u("photo-1647427017067-8f33ccbae493"), alt: "Nhân viên thao tác trên máy POS dạng tablet tại quầy" },
  packing: { src: u("photo-1449247666642-264389f5f5b1"), alt: "Người đóng gói đơn hàng vào thùng carton" },
  boutique: { src: u("photo-1441984904996-e0b6ba687e04"), alt: "Bên trong một cửa hàng quần áo với các giá treo" },
  warehouse: { src: u("photo-1587293852726-70cdb56c2866"), alt: "Kệ kho chất đầy thùng hàng" },
  cardPayment: { src: u("photo-1556742111-a301076d9d18"), alt: "Khách thanh toán bằng thẻ qua máy đọc thẻ" },
  livestream: { src: u("photo-1764162051296-63c5cddf6ba6"), alt: "Điện thoại trên chân máy đang phát trực tiếp bán hàng" },
  counter: { src: u("photo-1715635846028-f162249377c8"), alt: "Nhân viên đứng quầy tính tiền có máy tính bảng" },
  personHa: { src: u("photo-1484863137850-59afcfe05386"), alt: "Chân dung chị Thu Hà" },
  personQuan: { src: u("photo-1757744705465-ea08b0ddc38a"), alt: "Chân dung anh Minh Quân" },
  personHuy: { src: u("photo-1599548713969-3460f26dc07e"), alt: "Chân dung Gia Huy mặc tạp dề tại quán" },
} as const;
