package models

import "time"

type PictureItem struct {
	Type         string    `json:"type"`          // "picture"
	Name         string    `json:"name"`          // Tên file (vd: "hinh1.jpg")
	Path         string    `json:"path"`          // Đường dẫn tương đối (vd: "school/hinh1.jpg")
	URL          string    `json:"url"`           // Link URL xem ảnh hoàn chỉnh
	ThumbnailURL string    `json:"thumbnail_url"` // Link ảnh demo giảm chất lượng
	Size         int64     `json:"size"`          // Dung lượng tệp (bytes)
	Width        int       `json:"width"`         // Chiều rộng (px)
	Height       int       `json:"height"`        // Chiều cao (px)
	Extension    string    `json:"extension"`     // Đuôi tệp (vd: "jpg", "png")
	ModTime      time.Time `json:"mod_time"`      // Thời gian sửa đổi/thêm vào
}
