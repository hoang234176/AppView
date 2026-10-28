# Web — Agent Instructions

## 1. Quy tắc CSS & Styling
- **Tính cô lập (Scope Isolation)**: Mỗi file `.css` sẽ và chỉ viết CSS cho chính component/file hiện tại tương ứng.
- **Không lấn ranh giới (Boundary Isolation)**:
  - Tuyệt đối không viết CSS tác động hoặc áp đặt thuộc tính lên các **component con**.
  - Tuyệt đối không viết CSS vượt rào can thiệp lên các **component cha hoặc bậc cao hơn**.
- **Quy tắc Padding & Margin tuyệt đối (User Mandatory Rule)**:
  - TUYỆT ĐỐI KHÔNG tự ý thêm hoặc tăng `padding` hay `margin` vào bất kỳ thành phần nào (container, layout, thẻ mục, nút bấm, khối nội dung, v.v.) nếu người dùng không yêu cầu hoặc chưa cho phép rõ ràng.
  - Luôn giữ padding/margin ở mức 0 hoặc đúng chính xác theo chỉ định của người dùng.

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
- **Desktop (>= 768px)**: Sidebar mặc định chiếm `22%` chiều ngang khung app (cho phép kéo giãn tùy chỉnh từ tối thiểu `12%` đến tối đa `60%`, nhấp đúp vào thanh phân cách để khôi phục về `22%`).
- **Mobile & Tablet (< 768px)**:
  - Sidebar tự động chuyển thành Drawer trượt từ cạnh trái với hiệu ứng animation mượt mà.
  - Khi mở Drawer, hiển thị lớp phủ mờ (`.sidebar-overlay`) phía sau; nhấp vào overlay hoặc nút đóng sẽ thu Sidebar lại.
  - Header tự động hiển thị nút Hamburger để bật/tắt Sidebar.
- **Hỗ trợ Safe Area & Dynamic Viewport**:
  - Luôn sử dụng `height: 100dvh` để tránh lỗi tràn/vỡ layout khi thanh địa chỉ di động co giãn.
  - Thêm padding `env(safe-area-inset-top)` và `env(safe-area-inset-bottom)` cho Header và Content.

## 5. Quy tắc Header & Nút Điều Hướng
- **Thanh Header**: Nằm trong luồng bố cục bình thường (`height: calc(44px + 1vw); flex-shrink: 0; padding-bottom: 1vw;`), nền màu phẳng thuần nhất (`background-color: #ffffff` cho Light Mode, `#1f1f1f` cho Dark Mode). Không đè lên `main-content`, cách `main-content` một khoảng đệm chuẩn `1vw` (`MainLayout` giữ `gap: 0`).
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

## 8. Quy tắc Xử lý Bất đồng bộ (Async / Await Error Handling)
- **Luôn sử dụng cấu trúc `try...catch...finally` đầy đủ cho mọi tác vụ bất đồng bộ**: Mọi hàm, hành động hoặc luồng xử lý bất đồng bộ (`async`/`await`, gọi API mạng, Network Request, Coordinator RPC, v.v.) trong `frontend/web` bắt buộc phải được bọc trong cấu trúc đầy đủ `try...catch...finally`.
- **Trách nhiệm cụ thể của từng khối**:
  - `try`: Chứa logic gọi bất đồng bộ chính.
  - `catch`: Bắt và xử lý toàn bộ lỗi/ngoại lệ phát sinh, thông báo trạng thái lỗi rõ ràng (alert, thông báo UI), tuyệt đối không để sót unhandled rejection.
  - `finally`: Bắt buộc giải phóng, hoàn nguyên hoặc làm sạch các cờ trạng thái xử lý (như tắt loading `setLoading(false)`, `setIsConnecting(false)`, `setIsSaving(false)`, v.v.), đảm bảo giao diện luôn được mở khóa và không bao giờ bị treo cứng ở trạng thái chờ kể cả khi xảy ra lỗi.

## 9. Quy tắc Thông báo Lỗi & Kết nối Server (Server Connection & Notification Rules)
- **Bắt buộc kích hoạt thông báo lỗi trong khối `catch`**:
  - Mọi tác vụ bất đồng bộ, gọi API mạng hoặc kiểm tra kết nối khi có lỗi phát sinh trong khối `catch` **bắt buộc phải kích hoạt thẻ thông báo lỗi** thông qua `triggerNotification({ type: 'error', title: ..., message: ... })`. Tuyệt đối không chỉ ghi log console hoặc nuốt lỗi âm thầm.
  - Luôn đảm bảo khối `finally` giải phóng các cờ trạng thái (như tắt `isConnecting`, `isLoading`).
- **Xử lý kiểm tra kết nối khi khởi động (Initial Server Check)**:
  - Khi mở ứng dụng, nếu kết nối tới server đã lưu bị lỗi/thất bại: kích hoạt ngay thẻ thông báo lỗi tức thì (`triggerNotification`), đồng thời mở bảng `ServerConnectionModal` và tự động điền lại giá trị Host & Port cũ.
- **Xác thực dữ liệu đầu vào (Validation & Missing Inputs)**:
  - Khi người dùng nhập thiếu dữ liệu (để trống Host hoặc Port) hoặc sai định dạng: kích hoạt ngay thẻ thông báo lỗi tương ứng (`type: 'error'`) để phản hồi trực quan cho người dùng, ngăn chặn gửi request rác lên server.
- **Quy tắc Trạng thái Phiên Làm việc (Session State & 3 Services Config)**:
  - Cấu trúc cấu hình server trong phiên (`serverConfig`) được tạo sẵn 3 cặp key: `coordinator`, `download`, `storage`.
  - Mọi thao tác gọi server trong suốt phiên làm việc phải thông qua trạng thái phiên (`serverConfig`), không đọc trực tiếp từ `localStorage`.
  - Chỉ khi kết nối thành công (`result.ok === true`), giá trị input mới được phép cập nhật vào `serverConfig` của phiên và lưu vào `localStorage` (nếu có yêu cầu lưu).
  - Khi kết nối thất bại (nhập sai / lỗi mạng): tuyệt đối không cập nhật `serverConfig`, không lưu vào `localStorage`, giữ nguyên input cho người dùng và kích hoạt thông báo lỗi tức thì.
- **Quy tắc Từ ngữ Hiển thị (UI Terminology Invariant)**:
  - Từ ngữ "Coordinator" chỉ được sử dụng trong mã logic, tên biến/hàm (`checkCoordinatorHealth`, `coordinatorApi.js`) hoặc tài liệu kỹ thuật nội bộ.
  - Tuyệt đối không để từ "Coordinator" xuất hiện trên bất kỳ thành phần giao diện người dùng nào (tiêu đề, nhãn, thông báo popup, modal, placeholder); luôn sử dụng từ "Server" cho các chuỗi hiển thị ra UI.

## 10. Quy tắc Tách biệt Logic vào `src/hooks/` (Logic & Presentation Isolation)
- **File `.jsx` thuần túy hiển thị giao diện**:
  - Các file component `.jsx` chỉ chịu trách nhiệm render cây DOM/JSX và gắn kết các sự kiện/props.
  - Tuyệt đối không viết logic nghiệp vụ phức tạp, thuật toán tính toán, xử lý bất đồng bộ, hiệu ứng đo đạc DOM hay quản lý state nặng trực tiếp bên trong thân hàm component `.jsx`.
- **Tập trung hóa logic trong `src/hooks/`**:
  - Toàn bộ logic tính toán dữ liệu, API calls, effect và state tương tác phải được trừu tượng hóa và đóng gói thành các **Custom Hook** đặt trong thư mục `src/hooks/` (tạo file hoặc thư mục con tương ứng với tính năng).
- **Quy ước Component**:
  - Component `.jsx` chỉ import và gọi custom hook tương ứng để nhận về dữ liệu (`state`) và các hàm hành động (`handlers`) đã được xử lý hoàn chỉnh sẵn sàng để hiển thị.

## 11. Quy chuẩn Loading Overlay & Tuyệt đối Cấm Dùng Blur (No-Blur Invariant)
- **Độ phủ màu nền thống nhất (Overlay Background Opacity)**:
  - Mọi lớp phủ loading che khu vực/card trong ứng dụng (như khi đổi Drive trong Sidebar, hay khi bấm Save trong Settings) bắt buộc thống nhất sử dụng màu nền phẳng với độ phủ `0.7` (70% opacity):
    - Light mode: `rgba(250, 250, 250, 0.7)`
    - Dark mode: `rgba(28, 28, 28, 0.7)`
- **Tuyệt đối không bao giờ sử dụng hiệu ứng làm mờ (Never Use Blur / Backdrop-Filter)**:
  - Nghiêm cấm hoàn toàn việc sử dụng `backdrop-filter: blur(...)` hoặc `filter: blur(...)` cho các lớp phủ loading.
  - Lý do: Hiệu ứng blur buộc GPU phải rasterize và tính toán lại ma trận điểm ảnh liên tục trên diện rộng, gây tụt khung hình (tụt FPS), giật lag và hao tổn tài nguyên phần cứng. Mọi overlay loading chỉ được phép sử dụng màu nền bán trong suốt đơn thuần (`rgba`).

## 12. Quy tắc Bảo mật Cookies (Never Store Cookies in LocalStorage)
- **Tuyệt đối không lưu trữ dữ liệu Cookie mạng xã hội trong `localStorage` hay bất kỳ bộ nhớ client-side lâu dài nào**:
  - Dữ liệu Cookie đăng nhập (Netscape Cookie, session token của Facebook, YouTube, TikTok, v.v.) là thông tin định danh nhạy cảm cao, có nguy cơ bị rò rỉ nếu lưu trong `localStorage`.
  - Trên giao diện Frontend Web, dữ liệu Cookie chỉ được lưu tạm thời trong bộ nhớ phiên làm việc (in-memory React state) để phục vụ nhập liệu và kiểm tra hợp lệ.
  - Mọi thao tác lưu trữ vĩnh viễn Cookie chỉ được phép thực hiện trên máy chủ (Backend Storage Worker tại `~/.tmp-appview/cookies/` thông qua RPC Server được bảo vệ).
