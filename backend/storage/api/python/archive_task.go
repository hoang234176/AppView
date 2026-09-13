package pythonapi

// Archive jobs own every filesystem operation for a downloaded archive.  The
// Python service only resolves the source URL and mirrors this job's state to
// its WebSocket clients.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"backend/configs"
	"backend/events"
	"backend/multidownload"
	"backend/utils"
)

// LogInfo is kept local to Python-facing tasks; the common logger remains in
// utils, which no longer contains API job orchestration.
func LogInfo(format string, args ...interface{}) { utils.LogInfo(format, args...) }

type ArchiveJob struct {
	ID                string
	CanonicalID       string
	URL               string
	Filename          string
	Destination       string
	Stage             string
	DownloadedBytes   int64
	TotalBytes        int64
	SpeedBytes        int64
	ExtractedPct      float64
	ConvertTotal      int
	ConvertCurrent    int
	ConvertFailed     int
	ErrorCode         string
	Error             string
	PasswordNeeded    bool
	ArchiveDownloaded     bool
	ArchiveExtracted      bool
	VideoScanState        string
	TotalVideoCount       int
	OptimizationCancelled bool
	CancelledFromStage    string
	Videos                []VideoOptimization
	CreatedAt             time.Time
	UpdatedAt             time.Time
	archivePath           string
	extractedPath         string
	extractedName         string
	audioURL              string
	headers               map[string]string
	ctx                   context.Context
	cancel                context.CancelFunc
	mu                    sync.RWMutex
}

type ArchiveJobSnapshot struct {
	ID                    string  `json:"id"`
	CanonicalID           string  `json:"canonical_job_id,omitempty"`
	State                 string  `json:"state"`
	Filename              string  `json:"filename"`
	URL                   string  `json:"url,omitempty"`
	Destination           string  `json:"destination,omitempty"`
	DownloadedBytes       int64   `json:"downloaded_bytes"`
	TotalBytes            int64   `json:"total_bytes,omitempty"`
	SpeedBytes            int64   `json:"speed_bytes"`
	ExtractedPct          float64 `json:"extracted_percent,omitempty"`
	Conversion            struct {
		Total   int `json:"total"`
		Current int `json:"current"`
		Failed  int `json:"failed"`
	} `json:"conversion"`
	ErrorCode             string              `json:"error_code,omitempty"`
	Error                 string              `json:"error,omitempty"`
	PasswordNeeded        bool                `json:"password_required"`
	ArchiveDownloaded     bool                `json:"archive_downloaded"`
	ArchiveExtracted      bool                `json:"archive_extracted"`
	VideoScanState        string              `json:"video_scan_state,omitempty"`
	TotalVideoCount       int                 `json:"total_video_count,omitempty"`
	InvalidVideoCount     int                 `json:"invalid_video_count,omitempty"`
	OptimizationCancelled bool                `json:"optimization_cancelled,omitempty"`
	UnoptimizedVideoCount int                 `json:"unoptimized_video_count,omitempty"`
	CancelledFromStage    string              `json:"cancelled_from_stage,omitempty"`
	Videos                []VideoOptimization `json:"videos,omitempty"`
	ExtractedName         string              `json:"extracted_name,omitempty"`
	CreatedAt             time.Time           `json:"created_at"`
	UpdatedAt             time.Time           `json:"updated_at"`
}

// persistedArchiveJob is deliberately separate from ArchiveJob. It is the
// versioned, secret-free restart boundary owned by local Storage. In
// particular, archive passwords, contexts and cancellation functions are
// never written to disk.
type persistedArchiveJob struct {
	Version int                `json:"version"`
	Job     ArchiveJobSnapshot `json:"job"`
}

var archiveJobs = struct {
	sync.RWMutex
	items map[string]*ArchiveJob
}{items: make(map[string]*ArchiveJob)}

func SafeArchivePath(relative string) (string, error) {
	root := filepath.Clean(configs.DEFAULT_ROOT_PATH)
	// Public clients use absolute logical paths below Storage's configured root
	// (for example /Test or /Albums/Test). No library segment is implicit.
	// Strip only leading separators before joining, so filepath.Join can never
	// discard ROOT_PATH; traversal remains rejected below.
	logical := strings.TrimLeft(strings.TrimSpace(relative), "/\\")
	clean := filepath.Clean(logical)
	if clean == "." || clean == "" {
		return root, nil
	}
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("đường dẫn đích phải tương đối và nằm trong thư mục lưu trữ")
	}
	path := filepath.Join(root, clean)
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("đường dẫn đích nằm ngoài thư mục lưu trữ")
	}
	return path, nil
}

func safeArchivePath(relative string) (string, error) {
	return SafeArchivePath(relative)
}

func archiveTempDir() (string, error) { return configs.AppViewStateDir() }

func archiveStateDir() (string, error) {
	root, err := archiveTempDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	return filepath.Join(root, "downloads", "jobs"), nil
}

func archiveStatePath(id string) (string, error) {
	stateDir, err := archiveStateDir()
	if err != nil {
		return "", err
	}
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ")
	}
	return filepath.Join(stateDir, clean+".json"), nil
}

func archiveWorkspace(id string) (string, error) {
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ")
	}
	root, err := archiveTempDir()
	if err != nil {
		return "", fmt.Errorf("không xác định được thư mục trạng thái AppView: %w", err)
	}
	return filepath.Join(root, clean), nil
}

func archiveSafeName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "." || name == "" {
		return "archive.bin"
	}
	return name
}

func GetArchiveJobSnapshot(id string) (ArchiveJobSnapshot, bool) {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return ArchiveJobSnapshot{}, false
	}
	return archiveJobSnapshot(job), true
}

func GetArchiveJobSnapshots() []ArchiveJobSnapshot {
	archiveJobs.RLock()
	jobs := make([]*ArchiveJob, 0, len(archiveJobs.items))
	for _, job := range archiveJobs.items {
		jobs = append(jobs, job)
	}
	archiveJobs.RUnlock()
	result := make([]ArchiveJobSnapshot, 0, len(jobs))
	for _, job := range jobs {
		result = append(result, archiveJobSnapshot(job))
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.After(result[j].CreatedAt) })
	return result
}

func archiveJobSnapshot(job *ArchiveJob) ArchiveJobSnapshot {
	job.mu.RLock()
	defer job.mu.RUnlock()
	var result ArchiveJobSnapshot
	result.ID, result.CanonicalID, result.State, result.Filename = job.ID, job.CanonicalID, job.Stage, job.Filename
	result.URL, result.Destination = job.URL, job.Destination
	result.DownloadedBytes, result.TotalBytes, result.SpeedBytes = job.DownloadedBytes, job.TotalBytes, job.SpeedBytes
	result.ExtractedPct = job.ExtractedPct
	result.Conversion.Total, result.Conversion.Current, result.Conversion.Failed = job.ConvertTotal, job.ConvertCurrent, job.ConvertFailed
	result.ErrorCode, result.Error, result.PasswordNeeded = job.ErrorCode, job.Error, job.PasswordNeeded
	result.ArchiveDownloaded, result.ArchiveExtracted = job.ArchiveDownloaded, job.ArchiveExtracted
	result.VideoScanState, result.TotalVideoCount, result.ExtractedName = job.VideoScanState, job.TotalVideoCount, job.extractedName
	result.InvalidVideoCount = job.ConvertTotal
	result.OptimizationCancelled = job.OptimizationCancelled
	result.CancelledFromStage = job.CancelledFromStage
	unoptimized := 0
	if job.ConvertTotal > 0 {
		unoptimized = job.ConvertTotal - job.ConvertCurrent
		if unoptimized < 0 {
			unoptimized = 0
		}
	}
	result.UnoptimizedVideoCount = unoptimized
	result.Videos = append([]VideoOptimization(nil), job.Videos...)
	result.CreatedAt, result.UpdatedAt = job.CreatedAt, job.UpdatedAt
	return result
}

func persistArchiveJob(job *ArchiveJob) {
	snapshot := archiveJobSnapshot(job)
	path, err := archiveStatePath(snapshot.ID)
	if err != nil {
		LogInfo("[ARCHIVE] [%s] không thể xác định file trạng thái: %v", snapshot.ID, err)
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		LogInfo("[ARCHIVE] [%s] không thể tạo thư mục trạng thái: %v", snapshot.ID, err)
		return
	}
	encoded, err := json.Marshal(persistedArchiveJob{Version: 1, Job: snapshot})
	if err != nil {
		LogInfo("[ARCHIVE] [%s] không thể mã hóa trạng thái: %v", snapshot.ID, err)
		return
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, encoded, 0600); err != nil {
		LogInfo("[ARCHIVE] [%s] không thể ghi trạng thái: %v", snapshot.ID, err)
		return
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		LogInfo("[ARCHIVE] [%s] không thể hoàn tất ghi trạng thái: %v", snapshot.ID, err)
	}
}

func removePersistedArchiveJob(id string) {
	if path, err := archiveStatePath(id); err == nil {
		_ = os.Remove(path)
	}
}

// LoadPersistentArchiveJobs restores visible history after a Storage restart.
// Work that was active at shutdown is never guessed or resumed automatically:
// it is surfaced as interrupted so a client can choose the appropriate retry.
func LoadPersistentArchiveJobs() {
	stateDir, err := archiveStateDir()
	if err != nil {
		LogInfo("[ARCHIVE] không thể đọc trạng thái cũ: %v", err)
		return
	}
	entries, err := os.ReadDir(stateDir)
	if os.IsNotExist(err) {
		return
	}
	if err != nil {
		LogInfo("[ARCHIVE] không thể đọc thư mục trạng thái: %v", err)
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		contents, readErr := os.ReadFile(filepath.Join(stateDir, entry.Name()))
		if readErr != nil {
			continue
		}
		var persisted persistedArchiveJob
		if json.Unmarshal(contents, &persisted) != nil || persisted.Version != 1 || persisted.Job.ID == "" {
			LogInfo("[ARCHIVE] bỏ qua trạng thái không hợp lệ: %s", entry.Name())
			continue
		}
		snapshot := persisted.Job
		ctx, cancel := context.WithCancel(context.Background())
		dl := snapshot.DownloadedBytes
		tot := snapshot.TotalBytes
		if tot > 0 && dl > tot {
			tot = dl
		}
		job := &ArchiveJob{
			ID: snapshot.ID, CanonicalID: snapshot.CanonicalID, URL: snapshot.URL, Filename: archiveSafeName(snapshot.Filename), Destination: snapshot.Destination,
			Stage: snapshot.State, DownloadedBytes: dl, TotalBytes: tot,
			SpeedBytes: snapshot.SpeedBytes, ExtractedPct: snapshot.ExtractedPct, ConvertTotal: snapshot.Conversion.Total,
			ConvertCurrent: snapshot.Conversion.Current, ConvertFailed: snapshot.Conversion.Failed,
			ErrorCode: snapshot.ErrorCode, Error: snapshot.Error, PasswordNeeded: snapshot.PasswordNeeded,
			ArchiveDownloaded: snapshot.ArchiveDownloaded, ArchiveExtracted: snapshot.ArchiveExtracted,
			VideoScanState: snapshot.VideoScanState, TotalVideoCount: snapshot.TotalVideoCount,
			OptimizationCancelled: snapshot.OptimizationCancelled, CancelledFromStage: snapshot.CancelledFromStage,
			Videos:    append([]VideoOptimization(nil), snapshot.Videos...),
			CreatedAt: snapshot.CreatedAt, UpdatedAt: snapshot.UpdatedAt, ctx: ctx, cancel: cancel,
		}
		if job.CanonicalID == "" {
			job.CanonicalID = job.ID
		}
		if workspace, workspaceErr := archiveWorkspace(job.ID); workspaceErr == nil {
			archive := filepath.Join(workspace, job.Filename)
			if info, statErr := os.Stat(archive); statErr == nil && !info.IsDir() {
				job.archivePath, job.ArchiveDownloaded = archive, true
			}
			if extractedInfo, statErr := os.Stat(filepath.Join(workspace, "extracted")); statErr == nil && extractedInfo.IsDir() {
				extractedRoot := filepath.Join(workspace, "extracted")
				job.extractedPath, job.ArchiveExtracted = extractedRoot, true
				job.extractedName = snapshot.ExtractedName
				if job.extractedName == "" {
					job.extractedName = archiveFolderName(job.Filename)
				}
				if innerInfo, innerErr := os.Stat(filepath.Join(extractedRoot, job.extractedName)); innerErr == nil && innerInfo.IsDir() {
					job.extractedPath = filepath.Join(extractedRoot, job.extractedName)
				}
			}
		}
		if isActiveArchiveStage(job.Stage) {
			job.Stage, job.ErrorCode, job.Error = "interrupted", "STORAGE_RESTARTED", "Storage khởi động lại; tác vụ có thể tiếp tục bằng Retry."
		}
		archiveJobs.Lock()
		archiveJobs.items[job.ID] = job
		archiveJobs.Unlock()
		persistArchiveJob(job)
	}
}

func isActiveArchiveStage(stage string) bool {
	switch stage {
	case "queued", "downloading", "extracting", "scanning", "video_decision_required", "converting", "finalizing":
		return true
	default:
		return false
	}
}

func setArchiveStage(job *ArchiveJob, stage string) {
	job.mu.Lock()
	job.Stage, job.UpdatedAt = stage, time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] trạng thái -> %s", job.ID, stage)
}

func setArchiveError(job *ArchiveJob, code, message string) {
	job.mu.Lock()
	job.Stage, job.ErrorCode, job.Error, job.UpdatedAt = "error", code, message, time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] lỗi %s: %s", job.ID, code, message)
}

func StartArchiveJob(id, sourceURL, filename, destination, password string) error {
	return StartArchiveJobWithCanonicalIDAndStreams(id, sourceURL, filename, destination, password, id, "", nil)
}

func StartArchiveJobWithStreams(id, sourceURL, filename, destination, password, audioURL string, headers map[string]string) error {
	return StartArchiveJobWithCanonicalIDAndStreams(id, sourceURL, filename, destination, password, id, audioURL, headers)
}

// StartArchiveJobWithCanonicalID retains the Coordinator public parent ID as
// safe metadata while task execution continues to use the distinct child ID.
func StartArchiveJobWithCanonicalID(id, sourceURL, filename, destination, password, canonicalID string) error {
	return StartArchiveJobWithCanonicalIDAndStreams(id, sourceURL, filename, destination, password, canonicalID, "", nil)
}

func StartArchiveJobWithCanonicalIDAndStreams(id, sourceURL, filename, destination, password, canonicalID, audioURL string, headers map[string]string) error {
	if id == "" || sourceURL == "" {
		return fmt.Errorf("thiếu task_id hoặc URL tải")
	}
	if _, err := safeArchivePath(destination); err != nil {
		return err
	}
	if _, err := archiveWorkspace(id); err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(context.Background())
	now := time.Now().UTC()
	if strings.TrimSpace(canonicalID) == "" {
		canonicalID = id
	}
	job := &ArchiveJob{
		ID:          id,
		CanonicalID: canonicalID,
		URL:         sourceURL,
		Filename:    archiveSafeName(filename),
		Destination: destination,
		Stage:       "downloading",
		CreatedAt:   now,
		UpdatedAt:   now,
		audioURL:    audioURL,
		headers:     headers,
		ctx:         ctx,
		cancel:      cancel,
	}
	archiveJobs.Lock()
	if old := archiveJobs.items[id]; old != nil {
		old.cancel()
		CancelConvertJob(id)
	}
	archiveJobs.items[id] = job
	archiveJobs.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] nhận job tải %s vào thư mục tương đối %s", id, job.Filename, destination)
	go runArchiveJob(job, password, false)
	return nil
}

func SetArchiveJobCanonicalID(id, canonicalID string) bool {
	if strings.TrimSpace(canonicalID) == "" {
		return false
	}
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return false
	}
	job.mu.Lock()
	job.CanonicalID, job.UpdatedAt = canonicalID, time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	return true
}

func RetryArchiveExtraction(id, password string) error {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy archive job")
	}
	job.mu.Lock()
	if job.archivePath == "" {
		job.mu.Unlock()
		return fmt.Errorf("file archive tạm không còn tồn tại")
	}
	if job.cancel != nil {
		job.cancel()
	}
	job.ctx, job.cancel = context.WithCancel(context.Background())
	job.PasswordNeeded, job.Error, job.ErrorCode, job.Stage, job.UpdatedAt = false, "", "", "extracting", time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	go runArchiveJob(job, password, true)
	return nil
}

// RetryArchiveJob resumes from the furthest durable local artifact. It never
// restarts an already downloaded archive just because Storage was restarted.
// Password is accepted for this invocation only and is never persisted.
func RetryArchiveJob(id, password string) error {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy archive job")
	}
	job.mu.Lock()
	if job.cancel != nil {
		job.cancel()
	}
	job.ctx, job.cancel = context.WithCancel(context.Background())
	job.Error, job.ErrorCode, job.PasswordNeeded, job.UpdatedAt = "", "", false, time.Now().UTC()
	archivePath, extractedPath := job.archivePath, job.extractedPath
	if extractedPath != "" {
		job.Stage = "scanning"
	} else if archivePath != "" {
		job.Stage = "extracting"
	} else {
		job.Stage = "downloading"
	}
	job.mu.Unlock()
	persistArchiveJob(job)
	if extractedPath != "" {
		startArchiveConversion(job, extractedPath)
		return nil
	}
	if archivePath != "" {
		go runArchiveJob(job, password, true)
		return nil
	}
	go runArchiveJob(job, password, false)
	return nil
}

func CancelArchiveJob(id string) bool {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return false
	}
	job.mu.Lock()
	stage := job.Stage
	if stage == "cancelled" || stage == "completed" {
		job.mu.Unlock()
		return true
	}
	if stage == "cancelling" {
		job.mu.Unlock()
		return true
	}
	if stage == "converting" {
		job.Stage = "cancelling"
		job.OptimizationCancelled = true
		job.CancelledFromStage = "converting"
		job.UpdatedAt = time.Now().UTC()
		job.mu.Unlock()
		persistArchiveJob(job)
		CancelConvertJob(id)
		return true
	}
	if stage == "video_decision_required" {
		job.Stage = "cancelling"
		job.OptimizationCancelled = true
		job.CancelledFromStage = "video_decision_required"
		job.UpdatedAt = time.Now().UTC()
		extractedPath := job.extractedPath
		job.mu.Unlock()
		persistArchiveJob(job)
		go func() {
			cleanIncompleteOutputs(extractedPath)
			detachedCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			if err := commitArchiveResultWithContext(detachedCtx, job); err != nil {
				LogInfo("[ARCHIVE] [%s] commit sau hủy quyết định video thất bại: %v", job.ID, err)
				setArchiveError(job, "FINALIZE_FAILED", err.Error())
				return
			}
			setArchiveStage(job, "completed")
		}()
		return true
	}
	job.mu.Unlock()
	job.cancel()
	CancelConvertJob(id)
	setArchiveStage(job, "cancelled")
	return true
}

// SetVideoDecision persists one independent choice. It never trusts a UI
// index, never accepts an upscale, and does NOT start conversion.
func SetVideoDecision(id, videoID, quality string) error {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy archive job")
	}
	quality = strings.ToLower(strings.TrimSpace(quality))
	job.mu.Lock()
	if job.Stage != "video_decision_required" && job.Stage != "converting" {
		job.mu.Unlock()
		return fmt.Errorf("job không chờ quyết định video")
	}
	found := false
	for i := range job.Videos {
		video := &job.Videos[i]
		if video.ID != videoID {
			continue
		}
		found = true
		allowed := false
		for _, option := range video.AllowedQualities {
			if option == quality {
				allowed = true
				break
			}
		}
		if len(video.AllowedQualities) == 0 || !allowed {
			job.mu.Unlock()
			return fmt.Errorf("chất lượng không được hỗ trợ")
		}
		video.SelectedQuality, video.State, video.Error = quality, "ready", ""
		break
	}
	if !found {
		job.mu.Unlock()
		return fmt.Errorf("không tìm thấy video")
	}
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	// Partial or single decisions never trigger conversion; conversion requires explicit Apply.
	return nil
}

// ApplyVideoDecisions applies complete video choices and starts conversion.
// Partial decisions or missing required choices cannot start conversion.
// Duplicate apply when already converting is rejected and cannot start duplicate conversion.
func ApplyVideoDecisions(id string, decisions map[string]string) error {
	archiveJobs.RLock()
	job := archiveJobs.items[id]
	archiveJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy archive job")
	}
	job.mu.Lock()
	if job.Stage == "converting" {
		job.mu.Unlock()
		return fmt.Errorf("tác vụ đang trong quá trình tối ưu")
	}
	if job.Stage != "video_decision_required" {
		job.mu.Unlock()
		return fmt.Errorf("job không ở trạng thái chờ quyết định video")
	}

	if len(decisions) > 0 {
		for vID, q := range decisions {
			q = strings.ToLower(strings.TrimSpace(q))
			found := false
			for i := range job.Videos {
				video := &job.Videos[i]
				if video.ID == vID {
					found = true
					allowed := false
					for _, opt := range video.AllowedQualities {
						if opt == q {
							allowed = true
							break
						}
					}
					if len(video.AllowedQualities) == 0 || !allowed {
						job.mu.Unlock()
						return fmt.Errorf("chất lượng không được hỗ trợ cho video %s", vID)
					}
					video.SelectedQuality, video.State, video.Error = q, "ready", ""
					break
				}
			}
			if !found {
				job.mu.Unlock()
				return fmt.Errorf("không tìm thấy video %s", vID)
			}
		}
	}

	// Verify all required videos have a selection
	for _, video := range job.Videos {
		if video.OptimizationNeeded && video.SelectedQuality == "" {
			job.mu.Unlock()
			return fmt.Errorf("chưa chọn chất lượng cho tất cả video yêu cầu")
		}
	}

	job.Stage = "converting"
	job.UpdatedAt = time.Now().UTC()
	folder := job.extractedPath
	ctx := job.ctx
	job.mu.Unlock()
	setArchiveStage(job, "converting")
	persistArchiveJob(job)

	if folder != "" {
		go runSelectedArchiveConversion(job, folder, ctx)
	}
	return nil
}

func DeleteArchiveJob(id string) {
	archiveJobs.Lock()
	job := archiveJobs.items[id]
	delete(archiveJobs.items, id)
	archiveJobs.Unlock()
	if job != nil {
		job.cancel()
		CancelConvertJob(id)
	}
	// Delete chỉ xóa workspace SSD riêng của task, không bao giờ chạm HDD đích.
	if workspace, err := archiveWorkspace(id); err == nil {
		_ = os.RemoveAll(workspace)
	}
	if job != nil && job.archivePath != "" {
		_ = os.Remove(job.archivePath)
	}
	removePersistedArchiveJob(id)
}

func runArchiveJob(job *ArchiveJob, password string, extractionOnly bool) {
	if !extractionOnly {
		if err := downloadArchive(job); err != nil {
			if job.ctx.Err() == nil {
				setArchiveError(job, "DOWNLOAD_FAILED", err.Error())
			}
			return
		}
	}
	if job.ctx.Err() != nil {
		return
	}
	if !isArchiveFilename(job.Filename) {
		if err := prepareDirectMedia(job); err != nil {
			if job.ctx.Err() == nil {
				setArchiveError(job, "STAGE_FAILED", err.Error())
			}
		}
		return
	}
	if err := extractArchive(job, password); err != nil {
		if job.ctx.Err() != nil {
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "password") {
			job.mu.Lock()
			job.Stage, job.PasswordNeeded, job.ErrorCode, job.Error = "password_required", true, "PASSWORD_REQUIRED", err.Error()
			job.mu.Unlock()
			LogInfo("[ARCHIVE] [%s] yêu cầu mật khẩu giải nén", job.ID)
		} else {
			setArchiveError(job, "EXTRACT_FAILED", err.Error())
		}
	}
}

func downloadSingleStream(ctx context.Context, job *ArchiveJob, targetURL string, headers map[string]string, partPath string, initialBytes int64) (int64, error) {
	reporter := multidownload.NewProgressReporter(initialBytes, 500*time.Millisecond, func(downloaded, total, speed int64) {
		job.mu.Lock()
		job.DownloadedBytes = downloaded
		if total > 0 {
			if downloaded > total {
				total = downloaded
			}
			job.TotalBytes = total
		}
		job.SpeedBytes = speed
		job.UpdatedAt = time.Now().UTC()
		job.mu.Unlock()
		persistArchiveJob(job)
	})

	opts := multidownload.DownloadOptions{
		Headers:        headers,
		MaxConcurrency: multidownload.MaxConcurrency,
		Reporter:       reporter,
		PrepareRequest: func(req *http.Request) {
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
			}
		},
	}

	downloaded, err := multidownload.DownloadFile(ctx, targetURL, partPath, opts)
	reporter.Done()
	return downloaded, err
}

func downloadArchive(job *ArchiveJob) error {
	workspace, err := archiveWorkspace(job.ID)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(workspace, 0755); err != nil {
		return err
	}
	job.mu.RLock()
	audioURL := job.audioURL
	job.mu.RUnlock()

	if audioURL != "" {
		videoPart := filepath.Join(workspace, "video.part")
		audioPart := filepath.Join(workspace, "audio.part")

		reporter := multidownload.NewProgressReporter(0, 500*time.Millisecond, func(downloaded, total, speed int64) {
			job.mu.Lock()
			job.DownloadedBytes = downloaded
			if total > 0 {
				if downloaded > total {
					total = downloaded
				}
				job.TotalBytes = total
			}
			job.SpeedBytes = speed
			job.UpdatedAt = time.Now().UTC()
			job.mu.Unlock()
			persistArchiveJob(job)
		})

		err := multidownload.DownloadDualStream(job.ctx, multidownload.DualStreamConfig{
			VideoURL:      job.URL,
			VideoPartPath: videoPart,
			VideoHeaders:  job.headers,
			AudioURL:      audioURL,
			AudioPartPath: audioPart,
			AudioHeaders:  job.headers,
			Reporter:      reporter,
			PrepareRequest: func(req *http.Request) {
				if req.Header.Get("User-Agent") == "" {
					req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
				}
			},
		})
		if err != nil {
			return err
		}
		if job.ctx.Err() != nil {
			return job.ctx.Err()
		}
		finalPath := filepath.Join(workspace, job.Filename)
		_ = os.Remove(finalPath)
		LogInfo("[ARCHIVE] [%s] ghép luồng video và audio bằng ffmpeg", job.ID)
		cmd := exec.CommandContext(job.ctx, "ffmpeg", "-y", "-i", videoPart, "-i", audioPart, "-c", "copy", "-movflags", "+faststart", finalPath)
		if output, runErr := cmd.CombinedOutput(); runErr != nil {
			return fmt.Errorf("ghép video/audio thất bại: %s", strings.TrimSpace(string(output)))
		}
		_ = os.Remove(videoPart)
		_ = os.Remove(audioPart)
		job.mu.Lock()
		job.archivePath = finalPath
		job.ArchiveDownloaded = true
		job.UpdatedAt = time.Now().UTC()
		job.mu.Unlock()
		persistArchiveJob(job)
		LogInfo("[ARCHIVE] [%s] tải và ghép xong: %s", job.ID, job.Filename)
		return nil
	}

	partPath := filepath.Join(workspace, "download.part")
	_, err = downloadSingleStream(job.ctx, job, job.URL, job.headers, partPath, 0)
	if err != nil {
		return err
	}
	if job.ctx.Err() != nil {
		return job.ctx.Err()
	}
	finalPath := filepath.Join(workspace, job.Filename)
	_ = os.Remove(finalPath)
	if err := os.Rename(partPath, finalPath); err != nil {
		return err
	}
	job.mu.Lock()
	job.archivePath = finalPath
	job.ArchiveDownloaded = true
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] tải xong: %s", job.ID, job.Filename)
	return nil
}

func find7z() (string, error) {
	for _, name := range []string{"7zz", "7z", "/usr/local/bin/7zz", "/opt/homebrew/bin/7zz"} {
		if path, err := exec.LookPath(name); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("không tìm thấy 7zz hoặc 7z")
}

func extractArchive(job *ArchiveJob, password string) error {
	job.mu.RLock()
	archivePath, ctx := job.archivePath, job.ctx
	job.mu.RUnlock()
	if archivePath == "" {
		return fmt.Errorf("file archive tạm không còn tồn tại")
	}
	sevenZip, err := find7z()
	if err != nil {
		return err
	}
	workspace, err := archiveWorkspace(job.ID)
	if err != nil {
		return err
	}
	staging := filepath.Join(workspace, "extracted")
	_ = os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0755); err != nil {
		return err
	}
	setArchiveStage(job, "extracting")
	args := []string{"x", archivePath, "-o" + staging, "-y", "-bsp1"}
	if password == "" {
		args = append(args, "-p-")
	} else {
		args = append(args, "-p"+password)
	}
	output, runErr := exec.CommandContext(ctx, sevenZip, args...).CombinedOutput()
	if runErr != nil {
		_ = os.RemoveAll(staging)
		message := string(output)
		if strings.Contains(strings.ToLower(message), "wrong password") || strings.Contains(strings.ToLower(message), "encrypted") {
			return fmt.Errorf("password không chính xác hoặc archive cần mật khẩu")
		}
		return fmt.Errorf("7-Zip thất bại: %s", strings.TrimSpace(message))
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	job.mu.Lock()
	job.ExtractedPct, job.ArchiveExtracted, job.UpdatedAt = 100, true, time.Now().UTC()
	job.mu.Unlock()
	entries, err := os.ReadDir(staging)
	if err != nil {
		return err
	}
	name := archiveFolderName(job.Filename)
	source := staging
	if len(entries) == 1 && entries[0].IsDir() {
		source, name = filepath.Join(staging, entries[0].Name()), entries[0].Name()
	}
	_ = os.Remove(archivePath)
	job.mu.Lock()
	job.archivePath = ""
	job.extractedPath = source
	job.extractedName = name
	job.mu.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] giải nén xong trong SSD workspace: %s", job.ID, source)
	startArchiveConversion(job, source)
	return nil
}

func isArchiveFilename(filename string) bool {
	lower := strings.ToLower(filename)
	for _, ext := range []string{".tar.gz", ".tar.bz2", ".tar.xz", ".rar", ".zip", ".7z", ".tar", ".gz", ".xz", ".bz2", ".cbr", ".cbz", ".tgz"} {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

func prepareDirectMedia(job *ArchiveJob) error {
	job.mu.RLock()
	archivePath := job.archivePath
	job.mu.RUnlock()
	if archivePath == "" {
		return fmt.Errorf("file tải tạm không còn tồn tại")
	}
	workspace, err := archiveWorkspace(job.ID)
	if err != nil {
		return err
	}
	staging := filepath.Join(workspace, "extracted")
	_ = os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0755); err != nil {
		return err
	}
	targetFile := filepath.Join(staging, job.Filename)
	_ = os.Remove(targetFile)
	if err := os.Rename(archivePath, targetFile); err != nil {
		return fmt.Errorf("không thể chuyển file media vào thư mục chuẩn bị: %w", err)
	}
	name := archiveFolderName(job.Filename)
	job.mu.Lock()
	job.archivePath = ""
	job.ExtractedPct = 100
	job.ArchiveExtracted = true
	job.extractedPath = staging
	job.extractedName = name
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistArchiveJob(job)
	LogInfo("[ARCHIVE] [%s] file phương tiện đã sẵn sàng trong workspace: %s", job.ID, targetFile)
	startArchiveConversion(job, staging)
	return nil
}

func archiveFolderName(filename string) string {
	lower := strings.ToLower(filename)
	for _, ext := range []string{".tar.gz", ".tar.bz2", ".tar.xz", ".rar", ".zip", ".7z", ".tar", ".gz", ".xz", ".bz2", ".cbr", ".cbz", ".tgz", ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v"} {
		if strings.HasSuffix(lower, ext) {
			return strings.TrimSpace(filename[:len(filename)-len(ext)])
		}
	}
	return filename
}

func uniqueDirectory(parent, name string) string {
	path := filepath.Join(parent, name)
	for index := 1; ; index++ {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path
		}
		path = filepath.Join(parent, fmt.Sprintf("%s (%d)", name, index))
	}
}

func commitArchiveResult(job *ArchiveJob) error {
	job.mu.RLock()
	ctx := job.ctx
	job.mu.RUnlock()
	return commitArchiveResultWithContext(ctx, job)
}

func commitArchiveResultWithContext(ctx context.Context, job *ArchiveJob) error {
	job.mu.RLock()
	source, name, destination := job.extractedPath, job.extractedName, job.Destination
	job.mu.RUnlock()
	if source == "" || name == "" {
		return fmt.Errorf("không tìm thấy thư mục đã giải nén trong workspace")
	}
	destinationPath, err := safeArchivePath(destination)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(destinationPath, 0755); err != nil {
		return err
	}
	finalPath := uniqueDirectory(destinationPath, name)
	partialPath := finalPath + ".appview-copying-" + job.ID
	if err := os.RemoveAll(partialPath); err != nil {
		return fmt.Errorf("không thể dọn thư mục copy tạm: %w", err)
	}
	LogInfo("[ARCHIVE] [%s] chuyển kết quả SSD -> HDD: %s", job.ID, finalPath)
	if err := copyDirectoryContext(ctx, source, partialPath); err != nil {
		if ctx.Err() != nil {
			_ = os.RemoveAll(partialPath)
		}
		return err
	}
	if ctx.Err() != nil {
		_ = os.RemoveAll(partialPath)
		return ctx.Err()
	}
	if err := os.Rename(partialPath, finalPath); err != nil {
		return fmt.Errorf("không thể hoàn tất chuyển thư mục kết quả: %w", err)
	}
	// The SSD workspace is private. Emit one public destination invalidation
	// only after its atomic final rename has succeeded.
	cleanDest := strings.Trim(filepath.ToSlash(filepath.Clean(job.Destination)), "/")
	if cleanDest == "." {
		cleanDest = ""
	}
	parentPath := cleanDest
	publicPath := filepath.Base(finalPath)
	if parentPath != "" {
		publicPath = parentPath + "/" + filepath.Base(finalPath)
	}
	if err := events.Publish(events.FilesystemEvent{Type: "folder_created", Path: publicPath, NewPath: publicPath, ParentPath: parentPath}); err != nil {
		LogInfo("[ARCHIVE] [%s] không phát được filesystem event sau commit: %v", job.ID, err)
	}
	if workspace, err := archiveWorkspace(job.ID); err == nil {
		if err := os.RemoveAll(workspace); err != nil {
			LogInfo("[ARCHIVE] [%s] đã chuyển xong nhưng chưa dọn workspace %s: %v", job.ID, workspace, err)
		}
	}
	LogInfo("[ARCHIVE] [%s] đã chuyển hoàn tất đến HDD: %s", job.ID, finalPath)
	return nil
}

func copyDirectoryContext(ctx context.Context, source, target string) error {
	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("nguồn kết quả không phải thư mục: %s", source)
	}
	return filepath.Walk(source, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		output := filepath.Join(target, rel)
		if info.IsDir() {
			return os.MkdirAll(output, info.Mode().Perm())
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("không hỗ trợ mục không phải file/thư mục: %s", path)
		}
		return copyFileContext(ctx, path, output, info.Mode().Perm())
	})
}

func copyFileContext(ctx context.Context, source, target string, mode os.FileMode) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}
	output, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	defer output.Close()
	buffer := make([]byte, 1024*1024)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		count, readErr := input.Read(buffer)
		if count > 0 {
			if _, err := output.Write(buffer[:count]); err != nil {
				return err
			}
		}
		if readErr == io.EOF {
			return output.Sync()
		}
		if readErr != nil {
			return readErr
		}
	}
}

func startArchiveConversion(job *ArchiveJob, folder string) {
	job.mu.Lock()
	job.VideoScanState, job.UpdatedAt = "scanning", time.Now().UTC()
	job.mu.Unlock()
	setArchiveStage(job, "scanning")
	job.mu.RLock()
	ctx := job.ctx
	job.mu.RUnlock()
	go func() {
		// Give clients one polling interval to render the scanning state before
		// a fast ffprobe scan advances to conversion/completed.
		select {
		case <-time.After(900 * time.Millisecond):
		case <-ctx.Done():
			return
		}
		videos := ScanVideoOptimizations(ctx, folder)
		if ctx.Err() != nil {
			return
		}
		invalidTotal := 0
		for _, video := range videos {
			if video.OptimizationNeeded {
				invalidTotal++
			}
		}
		job.mu.Lock()
		job.Videos, job.ConvertTotal, job.TotalVideoCount, job.VideoScanState, job.UpdatedAt = videos, invalidTotal, len(videos), "completed", time.Now().UTC()
		job.mu.Unlock()
		persistArchiveJob(job)
		if invalidTotal == 0 {
			if err := commitArchiveResult(job); err != nil {
				if ctx.Err() == nil {
					setArchiveError(job, "FINALIZE_FAILED", err.Error())
				}
				return
			}
			setArchiveStage(job, "completed")
			return
		}
		needsDecision := false
		for _, video := range videos {
			if video.OptimizationNeeded && video.SelectedQuality == "" {
				needsDecision = true
				break
			}
		}
		if needsDecision {
			setArchiveStage(job, "video_decision_required")
			return
		}
		runSelectedArchiveConversion(job, folder, ctx)
	}()
}

func runSelectedArchiveConversion(job *ArchiveJob, folder string, ctx context.Context) {
	job.mu.Lock()
	plans := make(map[string]string)
	for _, video := range job.Videos {
		if video.OptimizationNeeded {
			plans[video.RelativePath] = video.SelectedQuality
		}
	}
	job.Stage = "converting"
	job.mu.Unlock()
	setArchiveStage(job, "converting")
	go func() {
		invalidTotal, _ := StartConvertJobWithContextPlans(ctx, job.ID, folder, plans)
		for {
			select {
			case <-time.After(time.Second):
			case <-ctx.Done():
				return
			}
			total, current, failed, _, _, done := GetConvertJobSnapshot(job.ID)
			job.mu.Lock()
			job.ConvertTotal, job.ConvertCurrent, job.ConvertFailed, job.UpdatedAt = total, current, failed, time.Now().UTC()
			convertedCount := current
			for i := range job.Videos {
				if job.Videos[i].OptimizationNeeded {
					if convertedCount > 0 {
						job.Videos[i].State = "completed"
						convertedCount--
					}
				}
			}
			job.mu.Unlock()
			persistArchiveJob(job)
			if done {
				cleanIncompleteOutputs(folder)

				job.mu.RLock()
				stage := job.Stage
				job.mu.RUnlock()

				if stage == "cancelling" {
					detachedCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
					defer cancel()
					if err := commitArchiveResultWithContext(detachedCtx, job); err != nil {
						LogInfo("[ARCHIVE] [%s] commit sau hủy thất bại: %v", job.ID, err)
						setArchiveError(job, "FINALIZE_FAILED", err.Error())
						return
					}
					setArchiveStage(job, "completed")
					return
				}

				if ctx.Err() != nil {
					return
				}
				if err := commitArchiveResult(job); err != nil {
					setArchiveError(job, "FINALIZE_FAILED", err.Error())
					return
				}
				if failed > 0 {
					setArchiveError(job, "VIDEO_CONVERT_UNAVAILABLE", fmt.Sprintf("Không tối ưu được %d/%d video", failed, invalidTotal))
				} else {
					setArchiveStage(job, "completed")
				}
				return
			}
		}
	}()
}
