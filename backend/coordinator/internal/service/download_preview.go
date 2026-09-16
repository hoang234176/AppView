package service

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"time"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/task"
)

type PreviewImageItem struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Label string `json:"label,omitempty"`
	Type  string `json:"type,omitempty"`
}

// DownloadPreview is the public metadata allowlist. Transfer URLs, headers
// and provider format dictionaries never cross this boundary.
type DownloadPreview struct {
	Source      string             `json:"source"`
	Type        string             `json:"type,omitempty"`
	Title       string             `json:"title"`
	Thumbnail   string             `json:"thumbnail,omitempty"`
	Uploader    string             `json:"uploader,omitempty"`
	Qualities   []int              `json:"qualities"`
	Images      []PreviewImageItem `json:"images,omitempty"`
	HasVideo    bool               `json:"has_video,omitempty"`
	HasAudio    bool               `json:"has_audio,omitempty"`
	Content     string             `json:"content,omitempty"`
	Author      any                `json:"author,omitempty"`
	CreatedTime string             `json:"created_time,omitempty"`
	Reactions   any                `json:"reactions,omitempty"`
	Photos      any                `json:"photos,omitempty"`
	Videos      any                `json:"videos,omitempty"`
	Items       any                `json:"items,omitempty"`
	RawInfo     any                `json:"raw_info,omitempty"`
}

func (c *Coordinator) PreviewDownload(ctx context.Context, sourceURL string) (DownloadPreview, *protocol.ErrorPayload) {
	failure := func(code, message string) (DownloadPreview, *protocol.ErrorPayload) {
		return DownloadPreview{}, &protocol.ErrorPayload{Code: code, Message: message}
	}
	parsed, err := url.Parse(strings.TrimSpace(sourceURL))
	if err != nil || parsed.Hostname() == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return failure("INVALID_URL", "Liên kết không hợp lệ.")
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	if ctx.Err() != nil {
		return failure("CANCELLED", "Đã hủy xem trước.")
	}
	created, err := c.createTask(string(protocol.ResolveDownload), mustJSON(map[string]string{"url": strings.TrimSpace(sourceURL), "operation": "preview"}), false, 1, nil)
	if err != nil {
		return failure("PREVIEW_FAILED", "Không thể bắt đầu xem trước.")
	}
	defer func() {
		c.abandonedPreviews.Store(created.ID, struct{}{})
		if active, ok := c.tasks.ReleaseTransient(created.ID); ok {
			c.cancelPreviewWorker(active.AssignedWorkerID, active.ID)
		} else {
			c.abandonedPreviews.Delete(created.ID)
		}
	}()
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	for {
		current, ok := c.tasks.Get(created.ID)
		if !ok {
			return failure("PREVIEW_FAILED", "Không thể xem trước video.")
		}
		if current.State == task.Completed {
			var preview DownloadPreview
			if json.Unmarshal(current.Result, &preview) != nil || (preview.Source != "youtube" && preview.Source != "tiktok" && preview.Source != "facebook" && preview.Source != "instagram" && preview.Source != "x" && preview.Source != "twitter") || preview.Title == "" {
				return failure("PREVIEW_FAILED", "Dữ liệu xem trước không hợp lệ.")
			}
			if preview.Source == "youtube" && len(preview.Qualities) == 0 {
				return failure("PREVIEW_FAILED", "Dữ liệu chất lượng không hợp lệ.")
			}
			for i, quality := range preview.Qualities {
				if quality <= 0 || (i > 0 && quality >= preview.Qualities[i-1]) {
					return failure("PREVIEW_FAILED", "Dữ liệu chất lượng không hợp lệ.")
				}
			}
			thumbnail, err := url.Parse(preview.Thumbnail)
			if err != nil || thumbnail.User != nil || thumbnail.Hostname() == "" || (thumbnail.Scheme != "https" && thumbnail.Scheme != "http") {
				preview.Thumbnail = ""
			}
			return preview, nil
		}
		if current.State == task.Failed {
			if current.Error != nil {
				return DownloadPreview{}, current.Error
			}
			return failure("PREVIEW_FAILED", "Không thể xem trước video.")
		}
		select {
		case <-ctx.Done():
			return failure("PREVIEW_TIMEOUT", "Đã dừng xem trước. Vui lòng thử lại.")
		case <-ticker.C:
		}
	}
}

func (c *Coordinator) cancelPreviewWorker(workerID, taskID string) {
	if registered, ok := c.workers.Get(workerID); ok {
		if err := registered.Sender.Send(protocol.Message{Type: protocol.TaskCancel, TaskID: taskID}); err != nil {
			c.WorkerDisconnected(workerID)
			c.releaseAbandonedPreview(taskID)
		}
	}
}

func (c *Coordinator) releaseAbandonedPreview(taskID string) {
	if _, abandoned := c.abandonedPreviews.LoadAndDelete(taskID); abandoned {
		c.tasks.ReleaseTransient(taskID)
	}
}
