package tiktok

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	pythonapi "backend/api/python"
	"backend/configs"
)

// DownloadItem represents an individual media item (e.g. image or audio) in a slideshow.
type DownloadItem struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Type     string `json:"type,omitempty"`
}

// Job represents the isolated lifecycle of a TikTok media download task in Storage.
type Job struct {
	ID                    string
	CanonicalID           string
	URL                   string
	Filename              string
	Destination           string
	State                 string
	DownloadedBytes       int64
	TotalBytes            int64
	SpeedBytes            int64
	ConvertTotal          int
	ConvertCurrent        int
	ConvertFailed         int
	ErrorCode             string
	Error                 string
	VideoScanState        string
	TotalVideoCount       int
	InvalidVideoCount     int
	OptimizationCancelled bool
	CancelledFromStage    string
	Videos                []pythonapi.VideoOptimization
	CreatedAt             time.Time
	UpdatedAt             time.Time
	audioURL              string
	items                 []DownloadItem
	headers               map[string]string
	ctx                   context.Context
	cancel                context.CancelFunc
	mu                    sync.RWMutex
}

// Snapshot is the thread-safe, serializable projection of a TikTok Job.
type Snapshot struct {
	ID                    string                        `json:"id"`
	CanonicalID           string                        `json:"canonical_job_id,omitempty"`
	State                 string                        `json:"state"`
	Filename              string                        `json:"filename"`
	URL                   string                        `json:"url,omitempty"`
	Destination           string                        `json:"destination,omitempty"`
	DownloadedBytes       int64                         `json:"downloaded_bytes"`
	TotalBytes            int64                         `json:"total_bytes,omitempty"`
	SpeedBytes            int64                         `json:"speed_bytes"`
	Conversion            struct {
		Total   int `json:"total"`
		Current int `json:"current"`
		Failed  int `json:"failed"`
	} `json:"conversion"`
	ErrorCode             string                        `json:"error_code,omitempty"`
	Error                 string                        `json:"error,omitempty"`
	VideoScanState        string                        `json:"video_scan_state,omitempty"`
	TotalVideoCount       int                           `json:"total_video_count,omitempty"`
	InvalidVideoCount     int                           `json:"invalid_video_count,omitempty"`
	OptimizationCancelled bool                          `json:"optimization_cancelled,omitempty"`
	CancelledFromStage    string                        `json:"cancelled_from_stage,omitempty"`
	Videos                []pythonapi.VideoOptimization `json:"videos,omitempty"`
	CreatedAt             time.Time                     `json:"created_at"`
	UpdatedAt             time.Time                     `json:"updated_at"`
}

type persistedJob struct {
	Version int      `json:"version"`
	Job     Snapshot `json:"job"`
}

func baseDir() (string, error) {
	return configs.AppViewStateDir()
}

// StateDir returns the directory where TikTok job JSON files are persisted:
// APPVIEW_STATE_DIR/media_download/tiktok/jobs
func StateDir() (string, error) {
	root, err := baseDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	return filepath.Join(root, "media_download", "tiktok", "jobs"), nil
}

// WorkspaceDir returns the private workspace directory for a specific TikTok job:
// APPVIEW_STATE_DIR/media_download/tiktok/workspaces/<job-id>
func WorkspaceDir(id string) (string, error) {
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ: %s", id)
	}
	root, err := baseDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	return filepath.Join(root, "media_download", "tiktok", "workspaces", clean), nil
}

// StatePath returns the file path for a specific TikTok job JSON:
// APPVIEW_STATE_DIR/media_download/tiktok/jobs/<job-id>.json
func StatePath(id string) (string, error) {
	dir, err := StateDir()
	if err != nil {
		return "", err
	}
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ: %s", id)
	}
	return filepath.Join(dir, clean+".json"), nil
}

func jobSnapshot(job *Job) Snapshot {
	var s Snapshot
	s.ID = job.ID
	s.CanonicalID = job.CanonicalID
	s.State = job.State
	s.Filename = job.Filename
	s.URL = job.URL
	s.Destination = job.Destination
	s.DownloadedBytes = job.DownloadedBytes
	s.TotalBytes = job.TotalBytes
	s.SpeedBytes = job.SpeedBytes
	s.Conversion.Total = job.ConvertTotal
	s.Conversion.Current = job.ConvertCurrent
	s.Conversion.Failed = job.ConvertFailed
	s.ErrorCode = job.ErrorCode
	s.Error = job.Error
	s.VideoScanState = job.VideoScanState
	s.TotalVideoCount = job.TotalVideoCount
	s.InvalidVideoCount = job.ConvertTotal
	s.OptimizationCancelled = job.OptimizationCancelled
	s.CancelledFromStage = job.CancelledFromStage
	s.Videos = append([]pythonapi.VideoOptimization(nil), job.Videos...)
	s.CreatedAt = job.CreatedAt
	s.UpdatedAt = job.UpdatedAt
	return s
}

func persistJob(job *Job) {
	job.mu.RLock()
	id := job.ID
	s := jobSnapshot(job)
	job.mu.RUnlock()

	path, err := StatePath(id)
	if err != nil {
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return
	}

	payload := persistedJob{
		Version: 1,
		Job:     s,
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return
	}

	tmpFile := path + ".tmp." + id
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return
	}
	_ = os.Rename(tmpFile, path)
}

func removePersistedJob(id string) {
	path, err := StatePath(id)
	if err == nil {
		_ = os.Remove(path)
	}
}

func safeFilename(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "." || name == "" || name == "/" || name == "\\" {
		return "tiktok_media"
	}
	return name
}

// uniqueFile returns collision-safe file path within parent folder.
// If filename already exists, appends " (1)", " (2)", etc., before the extension.
func uniqueFile(parent, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	path := filepath.Join(parent, filename)
	for index := 1; ; index++ {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path
		}
		path = filepath.Join(parent, fmt.Sprintf("%s (%d)%s", base, index, ext))
	}
}

// uniqueDir returns collision-safe directory path within parent folder.
func uniqueDir(parent, dirname string) string {
	path := filepath.Join(parent, dirname)
	for index := 1; ; index++ {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path
		}
		path = filepath.Join(parent, fmt.Sprintf("%s (%d)", dirname, index))
	}
}

func safeHistoryURL(value string) string {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	parsed.RawQuery, parsed.Fragment, parsed.User = "", "", nil
	return parsed.String()
}
