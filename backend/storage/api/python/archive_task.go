package pythonapi

// Archive jobs own every filesystem operation for a downloaded archive.  The
// Python service only resolves the source URL and mirrors this job's state to
// its WebSocket clients.

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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
	ID              string
	URL             string
	Filename        string
	Destination     string
	Stage           string
	DownloadedBytes int64
	TotalBytes      int64
	SpeedBytes      int64
	ExtractedPct    float64
	ConvertTotal    int
	ConvertCurrent  int
	ConvertFailed   int
	ErrorCode       string
	Error           string
	PasswordNeeded  bool
	archivePath     string
	extractedPath   string
	extractedName   string
	ctx             context.Context
	cancel          context.CancelFunc
	mu              sync.RWMutex
}

type ArchiveJobSnapshot struct {
	ID              string  `json:"id"`
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
	ErrorCode      string `json:"error_code,omitempty"`
	Error          string `json:"error,omitempty"`
	PasswordNeeded bool   `json:"password_required"`
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

func archiveTempDir() string { return configs.APPVIEW_WORKSPACE_PATH }

func archiveWorkspace(id string) (string, error) {
	clean := filepath.Base(strings.TrimSpace(id))
	if clean == "" || clean == "." || clean != id || strings.Contains(clean, "..") {
		return "", fmt.Errorf("task_id không hợp lệ")
	}
	return filepath.Join(archiveTempDir(), clean), nil
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
	return result
}

func archiveJobSnapshot(job *ArchiveJob) ArchiveJobSnapshot {
	job.mu.RLock()
	defer job.mu.RUnlock()
	var result ArchiveJobSnapshot
	result.ID, result.State, result.Filename = job.ID, job.Stage, job.Filename
	result.URL, result.Destination = job.URL, job.Destination
	result.DownloadedBytes, result.TotalBytes, result.SpeedBytes = job.DownloadedBytes, job.TotalBytes, job.SpeedBytes
	result.ExtractedPct = job.ExtractedPct
	result.Conversion.Total, result.Conversion.Current, result.Conversion.Failed = job.ConvertTotal, job.ConvertCurrent, job.ConvertFailed
	result.ErrorCode, result.Error, result.PasswordNeeded = job.ErrorCode, job.Error, job.PasswordNeeded
	return result
}

func setArchiveStage(job *ArchiveJob, stage string) {
	job.mu.Lock()
	job.Stage = stage
	job.mu.Unlock()
	LogInfo("[ARCHIVE] [%s] trạng thái -> %s", job.ID, stage)
}

func setArchiveError(job *ArchiveJob, code, message string) {
	job.mu.Lock()
	job.Stage, job.ErrorCode, job.Error = "error", code, message
	job.mu.Unlock()
	LogInfo("[ARCHIVE] [%s] lỗi %s: %s", job.ID, code, message)
}

func StartArchiveJob(id, sourceURL, filename, destination, password string) error {
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
	job := &ArchiveJob{ID: id, URL: sourceURL, Filename: archiveSafeName(filename), Destination: destination, Stage: "downloading", ctx: ctx, cancel: cancel}
	archiveJobs.Lock()
	if old := archiveJobs.items[id]; old != nil {
		old.cancel()
		CancelConvertJob(id)
	}
	archiveJobs.items[id] = job
	archiveJobs.Unlock()
	LogInfo("[ARCHIVE] [%s] nhận job tải %s vào thư mục tương đối %s", id, job.Filename, destination)
	go runArchiveJob(job, password, false)
	return nil
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
	job.PasswordNeeded, job.Error, job.ErrorCode, job.Stage = false, "", "", "extracting"
	job.mu.Unlock()
	go runArchiveJob(job, password, true)
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
			job.mu.Lock()
			job.DownloadedBytes += int64(count)
			now := time.Now()
			elapsed := now.Sub(lastTime).Seconds()
			if elapsed >= .5 {
				job.SpeedBytes = int64(float64(job.DownloadedBytes-lastBytes) / elapsed)
				lastBytes, lastTime = job.DownloadedBytes, now
			}
			job.mu.Unlock()
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
	job.mu.Unlock()
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
	job.ExtractedPct = 100
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
		total := StartConvertJobWithContext(ctx, job.ID, folder)
		if ctx.Err() != nil {
			return
		}
		job.mu.Lock()
		job.ConvertTotal = total
		job.mu.Unlock()
		if total == 0 {
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
			job.ConvertTotal, job.ConvertCurrent, job.ConvertFailed = total, current, failed
			job.mu.Unlock()
			if done {
				if ctx.Err() != nil {
					return
				}
				if err := commitArchiveResult(job); err != nil {
					setArchiveError(job, "FINALIZE_FAILED", err.Error())
					return
				}
				if failed > 0 {
					setArchiveError(job, "VIDEO_CONVERT_UNAVAILABLE", fmt.Sprintf("Không tối ưu được %d/%d video", failed, total))
				} else {
					setArchiveStage(job, "completed")
				}
				return
			}
		}
	}()
}
