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
- Thanh cuộn chỉ xuất hiện và cuộn độc lập bên trong vùng nội dung chính của `MainLayout` (`.main-content`).
- `.main-content`: Bắt đầu ngay dưới Header cách 1rem, sử dụng thanh cuộn mỏng tinh tế tự nhiên của hệ thống, không đè lấn nội dung và không bao giờ bị chui vào Header.
- Windows & các nền tảng: Hiển thị mỏng, tinh tế, tự động tương thích Dark/Light mode.

## 4. Quy tắc Responsive & Đa Nền Tảng (Mobile, Tablet, Windows)
- **Quản lý trạng thái Provider tại Root**: Toàn bộ Root Providers (`ThemeProvider`, `LayoutProvider`) được đặt tại [main.jsx](file:///Users/hoang/Projects/AppView/frontend/web/src/main.jsx) bọc ngoài `<App />`, giữ cho [App.jsx](file:///Users/hoang/Projects/AppView/frontend/web/src/App.jsx) thuần khiết làm Application Shell.
- **Desktop (>= 768px)**: Sidebar mặc định chiếm `22%` chiều ngang khung app (cho phép kéo giãn tùy chỉnh từ tối thiểu `10%` đến tối đa `60%`, nhấp đúp vào thanh phân cách để khôi phục về `22%`).
- **Mobile & Tablet (< 768px)**:
  - Sidebar tự động chuyển thành Drawer trượt từ cạnh trái với hiệu ứng animation mượt mà.
  - Khi mở Drawer, hiển thị lớp phủ mờ (`.sidebar-overlay`) phía sau; nhấp vào overlay hoặc nút đóng sẽ thu Sidebar lại.
  - Header tự động hiển thị nút Hamburger để bật/tắt Sidebar.
- **Hỗ trợ Safe Area & Dynamic Viewport**:
  - Luôn sử dụng `height: 100dvh` để tránh lỗi tràn/vỡ layout khi thanh địa chỉ di động co giãn.
  - Thêm padding `env(safe-area-inset-top)` và `env(safe-area-inset-bottom)` cho Header và Content.

## 5. Quy tắc Header & Nút Điều Hướng
- **Thanh Header**: Nằm trong luồng bố cục bình thường (`height: 44px; flex-shrink: 0;`), nền màu phẳng thuần nhất (`background-color: #ffffff` cho Light Mode, `#1f1f1f` cho Dark Mode). Không đè lên `main-content`, cách `main-content` một khoảng `gap: 0.5rem`.
- **Phân chia khu vực Header**:
  - `.header-left-zone`: Tối đa `40%` (`max-width: 40%`), chứa nút mobile (nếu có), viên thuốc `< >` và vùng dành cho tên thư mục sau này.
  - `.header-right-zone`: Tối đa `60%` (`max-width: 60%`), dồn sát về bên phải (`margin-left: auto`), chứa các nút thao tác độc lập (Tìm kiếm, Lọc, Tùy chọn, Download). Các nút chỉ chiếm kích thước thực, không bị kéo giãn.
  - Khoảng cách hình học chuẩn: `[Mép trái màn hình -> Sidebar] = [Sidebar -> Nút < >] = 1vw` (Sidebar có `margin-right: 1vw`, `.main-header` và `.main-content` có `padding-left: 0` để nút `< >` sát mép trái của Header không bị thò lồi mẩu nền thừa).
  - `.main-header` và `.main-content`: Đặt `padding-right: 0` để mép ngoài của các phần tử bên phải (nút Tìm kiếm, nội dung) đối xứng chuẩn xác 1:1 với mép trái của Sidebar thông qua `padding: 1vw` của `body`. `.main-content` sử dụng `padding-bottom: calc(0.5vw + env(safe-area-inset-bottom, 0))` để đồng bộ khoảng thở đáy.
- **Nút & Khối Viên Thuốc (Pill) trong Header**:
  - Dùng màu nền và viền đồng bộ chuẩn theo Sidebar: Light Mode `#fafafa` (viền `#e2e8f0`), Dark Mode `#1c1c1c` (viền `#2e2e2e`).
  - Cụm nút hành động bên phải (`FilterButton`, `MoreButton`, `DownloadButton`, `SearchPill`): Con trỏ chuột sử dụng `cursor: default`. Khi hover, màu nền chuyển xám nhẹ tinh tế (Light: `#f0f0f0`, Dark: `#333333`).
  - Nút Tìm kiếm (`SearchPill`): Trên Desktop Web, giữ nguyên 100% chiều cao của Header. Trạng thái đóng là hình tròn hoàn hảo đồng bộ với các nút, khi click mở rộng sang trái thành thanh viên thuốc `220px` với viền xanh macOS đè nội tuyến kết hợp giữ nguyên gờ phản quang giọt nước (`border-color: #007aff; box-shadow: inset 0 0 0 1px #007aff, inset 0 1px ...`), tự động focus input `placeholder="Search"`. Icon kính lúp giữ kích thước cố định 16px rõ nét ở bên trái, không bị co giật. Khi đóng, thanh search trượt co lại êm ái 2 chiều về nút tròn ban đầu. Nhấn Escape hoặc click ra ngoài (khi ô trống) sẽ đóng lại.
  - Hiệu ứng viền sáng nhẹ kiểu giọt nước ở mép bo tròn sử dụng `box-shadow: inset` (Light: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)`, Dark: `inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.2)`).
  - Tạm thời thuần UI trình bày, không gắn bất kỳ hàm xử lý hay logic điều hướng nào; con trỏ chuột giữ mặc định `cursor: default`.

## 6. Quy tắc Thành phần Xổ xuống (Accordion / Collapsible) & Form Hàng mục
- **Nguyên tắc đóng kín tuyệt đối (Zero-Leak Principle)**:
  - Khi component ở trạng thái đóng (`isExpanded === false`), thẻ phải khép kín 100% phẳng đẹp, không được để lộ bất kỳ khoảng hở chiều cao, `border`, `padding`, hay dải nền thừa nào.
  - Tuyệt đối không sử dụng CSS `grid-template-rows: 0fr` nếu phần tử con bên trong vẫn còn giữ `padding` hoặc `border-top` cố định, vì grid track không thể triệt tiêu được padding/border, sẽ gây lẹm dải nền thừa và kích hoạt thanh cuộn ngang rác (`overflow-x`).
  - Sử dụng cơ chế render có điều kiện `{isExpanded && (...)}` hoặc triệt tiêu hoàn toàn `padding` và `border` khi đóng, đảm bảo khi đóng thì hàng mục hiển thị chuẩn xác như một hàng đơn tĩnh macOS.
- **Phong cách hàng mục macOS (Settings Grouped Rows)**:
  - Header hàng mục gồm: icon squircle sắc nét (`28px` - `30px`, `border-radius: 7px`) bên trái, tên mục rõ ràng (không gắn các badge trạng thái thừa khi chưa yêu cầu), và mũi tên `ChevronRight` mỏng bên phải xoay `90°` khi mở.
  - Khung Card bo góc `12px` - `14px`, màu nền đồng bộ hệ thống (Light: `#fafafa`, Dark: `#1c1c1c`).
  - Các ô input không được tự ý gán giá trị mặc định khi người dùng chưa yêu cầu; chỉ sử dụng `placeholder` gợi ý mờ.

## 7. Quy tắc Quản lý & Vẽ Icon (Icon Management & Pure SVG)
- **Tuyệt đối không dùng icon hệ thống / thư viện ngoài**: Nghiêm cấm sử dụng icon của hệ điều hành, emoji hệ thống, hoặc cài đặt/import thư viện icon bên ngoài (như Lucide, Heroicons, FontAwesome, SF Symbols).
- **100% Vector SVG tự vẽ tay thuần**: Mọi icon trong dự án đều phải được viết bằng mã thẻ SVG thuần (`<svg>`, `<path>`, `<circle>`, `<rect>`) với `viewBox`, hỗ trợ kế thừa `className` và `{...props}`.
- **Tách file độc lập tại `src/assets/icons/`**: Mỗi icon bắt buộc là một component React riêng biệt lưu trong `frontend/web/src/assets/icons/` (ví dụ: `ServerIcon.jsx`, `CookieIcon.jsx`, `FacebookIcon.jsx`...), tuyệt đối không viết mã SVG trực tiếp bên trong component giao diện.
