package instagram

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

// DownloadItem represents an individual media item (photo or video) in an Instagram post.
type DownloadItem struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Type     string `json:"type,omitempty"`
}

// Job represents the isolated lifecycle of an Instagram media download task in Storage.
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

// Snapshot is the thread-safe, serializable projection of an Instagram Job.
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

// StateDir returns the directory where Instagram job JSON files are persisted:
// APPVIEW_STATE_DIR/media_download/instagram/jobs
func StateDir() (string, error) {
	root, err := baseDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	dir := filepath.Join(root, "media_download", "instagram", "jobs")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

// WorkspaceDir returns the private workspace directory for a specific Instagram job:
// APPVIEW_STATE_DIR/media_download/instagram/workspaces/<job-id>
func WorkspaceDir(id string) (string, error) {
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ: %s", id)
	}
	root, err := baseDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	return filepath.Join(root, "media_download", "instagram", "workspaces", clean), nil
}

// StatePath returns the file path for a specific Instagram job JSON:
// APPVIEW_STATE_DIR/media_download/instagram/jobs/<job-id>.json
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

func persistJob(job *Job) {
	stateDir, err := StateDir()
	if err != nil {
		return
	}
	snap := job.Snapshot()
	data, err := json.MarshalIndent(persistedJob{Version: 1, Job: snap}, "", "  ")
	if err != nil {
		return
	}
	tmpFile := filepath.Join(stateDir, fmt.Sprintf("%s.tmp", job.ID))
	targetFile := filepath.Join(stateDir, fmt.Sprintf("%s.json", job.ID))
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return
	}
	_ = os.Rename(tmpFile, targetFile)
}

func removePersistedJob(id string) {
	stateDir, err := StateDir()
	if err == nil {
		_ = os.Remove(filepath.Join(stateDir, fmt.Sprintf("%s.json", id)))
	}
}

func loadJob(id string) (*Snapshot, error) {
	stateDir, err := StateDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(stateDir, fmt.Sprintf("%s.json", id))
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var p persistedJob
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p.Job, nil
}

// Snapshot returns a copy of the current state of Job.
func (j *Job) Snapshot() Snapshot {
	j.mu.RLock()
	defer j.mu.RUnlock()

	var videosCopy []pythonapi.VideoOptimization
	if len(j.Videos) > 0 {
		videosCopy = make([]pythonapi.VideoOptimization, len(j.Videos))
		copy(videosCopy, j.Videos)
	}

	snap := Snapshot{
		ID:                    j.ID,
		CanonicalID:           j.CanonicalID,
		State:                 j.State,
		Filename:              j.Filename,
		URL:                   safeURL(j.URL),
		Destination:           j.Destination,
		DownloadedBytes:       j.DownloadedBytes,
		TotalBytes:            j.TotalBytes,
		SpeedBytes:            j.SpeedBytes,
		ErrorCode:             j.ErrorCode,
		Error:                 j.Error,
		VideoScanState:        j.VideoScanState,
		TotalVideoCount:       j.TotalVideoCount,
		InvalidVideoCount:     j.InvalidVideoCount,
		OptimizationCancelled: j.OptimizationCancelled,
		CancelledFromStage:    j.CancelledFromStage,
		Videos:                videosCopy,
		CreatedAt:             j.CreatedAt,
		UpdatedAt:             j.UpdatedAt,
	}
	snap.Conversion.Total = j.ConvertTotal
	snap.Conversion.Current = j.ConvertCurrent
	snap.Conversion.Failed = j.ConvertFailed
	return snap
}

func safeURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	parsed.RawQuery = ""
	parsed.User = nil
	return parsed.String()
}

func safeFilename(name string) string {
	clean := filepath.Base(filepath.Clean(name))
	if clean == "." || clean == "/" || clean == "" {
		return "instagram_post.mp4"
	}
	return clean
}

func uniqueFile(parent, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	candidate := filepath.Join(parent, filename)
	index := 1
	for {
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
		candidate = filepath.Join(parent, fmt.Sprintf("%s (%d)%s", base, index, ext))
		index++
	}
}
