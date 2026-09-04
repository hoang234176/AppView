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
	ArchiveDownloaded bool
	ArchiveExtracted  bool
	VideoScanState    string
	TotalVideoCount   int
	CreatedAt         time.Time
	UpdatedAt         time.Time
	archivePath       string
	extractedPath     string
	extractedName     string
	ctx               context.Context
	cancel            context.CancelFunc
	mu                sync.RWMutex
}

type ArchiveJobSnapshot struct {
	ID              string  `json:"id"`
	CanonicalID     string  `json:"canonical_job_id,omitempty"`
	State           string  `json:"state"`
	Filename        string  `json:"filename"`
	URL             string  `json:"url,omitempty"`
	Destination     string  `json:"destination,omitempty"`
	DownloadedBytes int64   `json:"downloaded_bytes"`
	TotalBytes      int64   `json:"total_bytes,omitempty"`
	SpeedBytes      int64   `json:"speed_bytes"`
	ExtractedPct    float64 `json:"extracted_percent,omitempty"`
	Conversion      struct {
		Total   int `json:"total"`
		Current int `json:"current"`
		Failed  int `json:"failed"`
	} `json:"conversion"`
	ErrorCode         string    `json:"error_code,omitempty"`
	Error             string    `json:"error,omitempty"`
	PasswordNeeded    bool      `json:"password_required"`
	ArchiveDownloaded bool      `json:"archive_downloaded"`
	ArchiveExtracted  bool      `json:"archive_extracted"`
	VideoScanState    string    `json:"video_scan_state,omitempty"`
	TotalVideoCount   int       `json:"total_video_count,omitempty"`
	InvalidVideoCount int       `json:"invalid_video_count,omitempty"`
	ExtractedName     string    `json:"extracted_name,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
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

func safeArchivePath(relative string) (string, error) {
	root := filepath.Clean(configs.DEFAULT_ROOT_PATH)
	clean := filepath.Clean(strings.TrimSpace(relative))
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
		job := &ArchiveJob{
			ID: snapshot.ID, CanonicalID: snapshot.CanonicalID, URL: snapshot.URL, Filename: archiveSafeName(snapshot.Filename), Destination: snapshot.Destination,
			Stage: snapshot.State, DownloadedBytes: snapshot.DownloadedBytes, TotalBytes: snapshot.TotalBytes,
			SpeedBytes: snapshot.SpeedBytes, ExtractedPct: snapshot.ExtractedPct, ConvertTotal: snapshot.Conversion.Total,
			ConvertCurrent: snapshot.Conversion.Current, ConvertFailed: snapshot.Conversion.Failed,
			ErrorCode: snapshot.ErrorCode, Error: snapshot.Error, PasswordNeeded: snapshot.PasswordNeeded,
			ArchiveDownloaded: snapshot.ArchiveDownloaded, ArchiveExtracted: snapshot.ArchiveExtracted,
			VideoScanState: snapshot.VideoScanState, TotalVideoCount: snapshot.TotalVideoCount,
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
	case "queued", "downloading", "extracting", "scanning", "converting", "finalizing":
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
	return StartArchiveJobWithCanonicalID(id, sourceURL, filename, destination, password, id)
}

// StartArchiveJobWithCanonicalID retains the Coordinator public parent ID as
// safe metadata while task execution continues to use the distinct child ID.
func StartArchiveJobWithCanonicalID(id, sourceURL, filename, destination, password, canonicalID string) error {
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
	job := &ArchiveJob{ID: id, CanonicalID: canonicalID, URL: sourceURL, Filename: archiveSafeName(filename), Destination: destination, Stage: "downloading", CreatedAt: now, UpdatedAt: now, ctx: ctx, cancel: cancel}
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
	job.cancel()
	CancelConvertJob(id)
	setArchiveStage(job, "cancelled")
	return true
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

func downloadArchive(job *ArchiveJob) error {
	workspace, err := archiveWorkspace(job.ID)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(workspace, 0755); err != nil {
		return err
	}
	partPath := filepath.Join(workspace, "download.part")
	var existingBytes int64
	if info, statErr := os.Stat(partPath); statErr == nil {
		existingBytes = info.Size()
	}
	request, err := http.NewRequestWithContext(job.ctx, http.MethodGet, job.URL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
	if existingBytes > 0 {
		request.Header.Set("Range", fmt.Sprintf("bytes=%d-", existingBytes))
	}
	response, err := (&http.Client{Timeout: 0}).Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("máy chủ tải trả HTTP %d", response.StatusCode)
	}
	appendMode := existingBytes > 0 && response.StatusCode == http.StatusPartialContent
	if existingBytes > 0 && !appendMode {
		// Source did not honour Range; safely restart rather than corrupting the file.
		existingBytes = 0
	}
	fileFlags := os.O_CREATE | os.O_WRONLY
	if appendMode {
		fileFlags |= os.O_APPEND
	} else {
		fileFlags |= os.O_TRUNC
	}
	file, err := os.OpenFile(partPath, fileFlags, 0644)
	if err != nil {
		return err
	}
	defer file.Close()
	job.mu.Lock()
	job.DownloadedBytes = existingBytes
	if response.ContentLength > 0 {
		job.TotalBytes = existingBytes + response.ContentLength
	} else {
		job.TotalBytes = response.ContentLength
	}
	job.mu.Unlock()
	if appendMode {
		LogInfo("[DOWNLOAD SERVICE] Task [%s] tiếp tục tải từ %.1f MB", job.ID, float64(existingBytes)/(1024*1024))
	}
	buffer := make([]byte, 1024*1024)
	lastBytes, lastTime := int64(0), time.Now()
	for {
		count, readErr := response.Body.Read(buffer)
		if count > 0 {
			if _, err := file.Write(buffer[:count]); err != nil {
				return err
			}
			shouldPersist := false
			job.mu.Lock()
			job.DownloadedBytes += int64(count)
			now := time.Now()
			elapsed := now.Sub(lastTime).Seconds()
			if elapsed >= .5 {
				job.SpeedBytes = int64(float64(job.DownloadedBytes-lastBytes) / elapsed)
				lastBytes, lastTime = job.DownloadedBytes, now
				job.UpdatedAt = now.UTC()
				shouldPersist = true
			}
			job.mu.Unlock()
			if shouldPersist {
				persistArchiveJob(job)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	if err := file.Close(); err != nil {
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

func archiveFolderName(filename string) string {
	lower := strings.ToLower(filename)
	for _, ext := range []string{".tar.gz", ".tar.bz2", ".tar.xz", ".rar", ".zip", ".7z", ".tar", ".gz", ".xz", ".bz2", ".cbr", ".cbz", ".tgz"} {
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

// commitArchiveResult là bước duy nhất ghi vào thư viện HDD. Dữ liệu được copy
// sang một thư mục cùng volume có hậu tố tạm, rồi rename nguyên tử thành tên
// cuối. Vì vậy thư viện không bao giờ thấy một folder kết quả chưa copy xong.
func commitArchiveResult(job *ArchiveJob) error {
	job.mu.RLock()
	source, name, destination, ctx := job.extractedPath, job.extractedName, job.Destination, job.ctx
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
		invalidTotal, videoTotal := StartConvertJobWithContextSummary(ctx, job.ID, folder)
		if ctx.Err() != nil {
			return
		}
		job.mu.Lock()
		job.ConvertTotal, job.TotalVideoCount, job.VideoScanState, job.UpdatedAt = invalidTotal, videoTotal, "completed", time.Now().UTC()
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
		setArchiveStage(job, "converting")
		for {
			select {
			case <-time.After(time.Second):
			case <-ctx.Done():
				return
			}
			total, current, failed, _, _, done := GetConvertJobSnapshot(job.ID)
			job.mu.Lock()
			job.ConvertTotal, job.ConvertCurrent, job.ConvertFailed, job.UpdatedAt = total, current, failed, time.Now().UTC()
			job.mu.Unlock()
			persistArchiveJob(job)
			if done {
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
