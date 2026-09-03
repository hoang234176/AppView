package models

import "time"

type VideoItem struct {
	Type         string    `json:"type"`          // "video"
	Name         string    `json:"name"`          // "clip.mp4"
	Path         string    `json:"path"`          // "travel/clip.mp4"
	URL          string    `json:"url"`           // Link stream video
	ThumbnailURL string    `json:"thumbnail_url"` // Ảnh bìa poster đại diện
	Size         int64     `json:"size"`          // Dung lượng byte
	Width        int       `json:"width"`         // Chiều rộng (px)
	Height       int       `json:"height"`        // Chiều cao (px)
	Extension    string    `json:"extension"`     // Đuôi tệp (vd: "mp4", "webm")
	Resolution   string    `json:"resolution"`    // Độ phân giải (vd: "1080p", "4K")
	ModTime      time.Time `json:"mod_time"`
}
