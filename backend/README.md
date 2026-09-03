# 📸 Local Media Server (Golang Fiber)

Backend RESTful API hiệu năng cao xây dựng bằng **Golang** và framework **Fiber**, phục vụ việc duyệt cây thư mục và stream hình ảnh từ ổ cứng máy Mac / Linux đến các thiết bị (Web/Mobile) cùng mạng LAN/Wi-Fi theo cơ chế Lazy Loading (phân tầng).

---

## 🚀 Tính năng chính

- **Kiến trúc phân tầng (Layered MVC):** Tách biệt rõ ràng `routes`, `controllers`, `services`, `models`, `utils`.
- **Duyệt thư mục phân tầng (Lazy Loading):** Chỉ đọc 1 cấp thư mục/ảnh theo yêu cầu, tiết kiệm RAM và băng thông.
- **Hỗ trợ định dạng ảnh:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`.
- **Hỗ trợ mạng LAN:** Mở cổng `0.0.0.0` cho phép các thiết bị cùng mạng Wi-Fi truy cập trực tiếp.
- **Format JSON chuẩn:** Mọi phản hồi đều theo cấu trúc `{ status, message, data }`.

---

## 📁 Cấu trúc thư mục dự án

```text
backend/
├── controllers/          # Nhận request và trả JSON/file
│   ├── ping_controller.go
│   └── media_controller.go
├── models/               # Định nghĩa khuôn mẫu Struct dữ liệu
│   └── media.go
├── routes/               # Quản lý và gom nhóm các tuyến API (/api/v1)
│   └── routes.go
├── services/             # Tầng nghiệp vụ xử lý đọc/quét ổ đĩa
│   └── media_service.go
├── utils/                # Helper (Format response JSON, Logger)
│   ├── response.go
│   └── logger.go
├── go.mod
├── go.sum
├── main.go               # Khởi chạy server và gắn middleware
└── README.md
```

---

## 🛠️ Yêu cầu & Cài đặt

### Yêu cầu hệ thống:
- Go 1.20 trở lên

### Cài đặt thư viện:
```bash
go mod tidy
```

### Chạy ứng dụng:
```bash
go run main.go
```
*Server mặc định lắng nghe tại cổng `http://0.0.0.0:8080`.*

---

## 📡 Danh sách API (Endpoints)

Base URL: `http://<SERVER_IP>:8080/api/v1`

### 1. Kiểm tra kết nối
- **Method:** `GET`
- **URL:** `/api/v1/ping`
- **Mô tả:** Kiểm tra trạng thái server, IP và User-Agent thiết bị gọi.
- **Response mẫu:**
  ```json
  {
    "status": "success",
    "message": "Kết nối thành công",
    "data": {
      "ip": "192.168.1.15",
      "server": "Media Server"
    }
  }
  ```

### 2. Lấy danh sách thư mục & ảnh theo đường dẫn
- **Method:** `GET`
- **URL:** `/api/v1/content?path={relative_folder_path}`
- **Query Params:**
  - `path` *(tùy chọn)*: Đường dẫn thư mục tương đối (bỏ trống để lấy thư mục gốc).
- **Response mẫu:**
  ```json
  {
    "status": "success",
    "message": "Lấy nội dung thư mục thành công",
    "data": [
      {
        "type": "folder",
        "name": "school",
        "path": "Pictures/school"
      },
      {
        "type": "file",
        "name": "hinh1.jpg",
        "path": "Pictures/hinh1.jpg",
        "url": "/api/v1/files/Pictures/hinh1.jpg"
      }
    ]
  }
  ```

### 3. Xem / Stream ảnh trực tiếp
- **Method:** `GET`
- **URL:** `/api/v1/files/{path_to_image}`
- **Ví dụ:** `http://192.168.1.15:8080/api/v1/files/Pictures/school/hinh1.jpg`
- **Mô tả:** Trả về dữ liệu file ảnh nhị phân (stream trực tiếp từ ổ cứng) để hiển thị lên thẻ `<img>` hoặc mobile UI.