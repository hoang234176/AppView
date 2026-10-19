# Web — Agent Instructions

## 1. Quy tắc CSS & Styling
- **Tính cô lập (Scope Isolation)**: Mỗi file `.css` sẽ và chỉ viết CSS cho chính component/file hiện tại tương ứng.
- **Không lấn ranh giới (Boundary Isolation)**:
  - Tuyệt đối không viết CSS tác động hoặc áp đặt thuộc tính lên các **component con**.
  - Tuyệt đối không viết CSS vượt rào can thiệp lên các **component cha hoặc bậc cao hơn**.

## 2. Quy tắc Dark / Light Mode Tự động
- **Tự động theo hệ thống**: Ứng dụng tự động chuyển đổi giao diện sáng/tối theo cài đặt của hệ điều hành thông qua script chống chớp trắng (anti-FOUT) trong `index.html` và `ThemeProvider` tại `main.jsx`.
- **Chống chớp trắng (Anti-FOUT)**:
  - Thẻ `<head>` trong `index.html` chứa script phát hiện và gắn `.dark` đồng bộ trước khi trình duyệt render frame đầu tiên.
  - `main.css` thiết lập màu nền gốc cho `html` và `html.dark` tương ứng.
- **Yêu cầu bắt buộc khi tạo hoặc sửa đổi**:
  - Mọi khối UI (components, layouts) khi thêm mới hoặc chỉnh sửa **bắt buộc phải kiểm tra và hỗ trợ đầy đủ cả 2 chế độ Sáng (Light) và Tối (Dark)**.
  - Sử dụng class Tailwind với tiền tố `dark:...` hoặc selector `:is(.dark, :root.dark) .ten-class` trong file CSS cô lập của component.
  - Tuyệt đối không hardcode duy nhất một màu cố định gây lệch tông khi chuyển chế độ giao diện.

## 3. Quy tắc Cuộn & Layout
- Khung hình ứng dụng cố định toàn trang (`html, body, #root` có `overflow: hidden; height: 100%; height: 100dvh`).
- Thanh cuộn chỉ xuất hiện và cuộn độc lập bên trong vùng nội dung chính của `MainLayout` (`.main-layout-content`).
- Windows: Tùy biến scrollbar mỏng, tinh tế và tương thích Dark/Light mode trong `main.css`.

## 4. Quy tắc Responsive & Đa Nền Tảng (Mobile, Tablet, Windows)
- **Quản lý trạng thái Provider tại Root**: Toàn bộ Root Providers (`ThemeProvider`, `LayoutProvider`) được đặt tại [main.jsx](file:///Users/hoang/Projects/AppView/frontend/web/src/main.jsx) bọc ngoài `<App />`, giữ cho [App.jsx](file:///Users/hoang/Projects/AppView/frontend/web/src/App.jsx) thuần khiết làm Application Shell.
- **Desktop (>= 768px)**: Sidebar hiển thị cố định bên trái (`width: 260px`).
- **Mobile & Tablet (< 768px)**:
  - Sidebar tự động chuyển thành Drawer trượt từ cạnh trái với hiệu ứng animation mượt mà.
  - Khi mở Drawer, hiển thị lớp phủ mờ (`.sidebar-overlay`) phía sau; nhấp vào overlay hoặc nút đóng sẽ thu Sidebar lại.
  - Header tự động hiển thị nút Hamburger để bật/tắt Sidebar.
- **Hỗ trợ Safe Area & Dynamic Viewport**:
  - Luôn sử dụng `height: 100dvh` để tránh lỗi tràn/vỡ layout khi thanh địa chỉ di động co giãn.
  - Thêm padding `env(safe-area-inset-top)` và `env(safe-area-inset-bottom)` cho Header và Content.
