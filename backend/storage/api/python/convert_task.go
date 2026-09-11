package pythonapi

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ConvertJob lưu trạng thái một job convert cho một task_id.
type ConvertJob struct {
	TaskID         string
	Total          int
	Current        int
	CurrentName    string
	CurrentPercent float64
	Failed         int
	Qualities      map[string]string
	Done           bool
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.Mutex
}

var (
	convertJobs   = make(map[string]*ConvertJob)
	convertJobsMu sync.RWMutex
	// Toàn hệ thống chỉ có một archive job được chạy ffmpeg tại một thời điểm.
	// Video 4K có thể dùng nhiều GB RAM; không cho nhiều thư mục convert song
	// song, và một job giữ lượt đến khi xử lý hết danh sách video của nó.
	convertJobSemaphore = make(chan struct{}, 1)
)

// GetConvertJob trả về job theo taskID (thread-safe).
func GetConvertJob(taskID string) *ConvertJob {
	convertJobsMu.RLock()
	defer convertJobsMu.RUnlock()
	return convertJobs[taskID]
}

// GetConvertJobSnapshot trả về snapshot an toàn để serialize.
func GetConvertJobSnapshot(taskID string) (total, current, failed int, currentName string, currentPercent float64, done bool) {
	convertJobsMu.RLock()
	job := convertJobs[taskID]
	convertJobsMu.RUnlock()
	if job == nil {
		return 0, 0, 0, "", 0, true
	}
	job.mu.Lock()
	defer job.mu.Unlock()
	return job.Total, job.Current, job.Failed, job.CurrentName, job.CurrentPercent, job.Done
}

func deleteConvertJob(taskID string) {
	convertJobsMu.Lock()
	defer convertJobsMu.Unlock()
	delete(convertJobs, taskID)
}

// CancelConvertJob dừng ffmpeg đang chạy và ngăn job bắt đầu file kế tiếp.
// Nó không xóa video gốc; output staging dở dang sẽ bị dọn an toàn.
func CancelConvertJob(taskID string) bool {
	convertJobsMu.RLock()
	job := convertJobs[taskID]
	convertJobsMu.RUnlock()
	if job == nil {
		return false
	}
	job.mu.Lock()
	if job.cancel != nil {
		job.cancel()
	}
	job.mu.Unlock()
	LogInfo("[CONVERT] [%s] Đã nhận yêu cầu hủy convert.", taskID)
	return true
}

var videoExtensions = map[string]bool{
	".mp4":  true,
	".m4v":  true,
	".mov":  true,
	".mkv":  true,
	".avi":  true,
	".flv":  true,
	".wmv":  true,
	".ts":   true,
	".3gp":  true,
	".webm": true,
}

type ffprobeMedia struct {
	Format struct {
		FormatName string `json:"format_name"`
	} `json:"format"`
	Streams []struct {
		CodecType string `json:"codec_type"`
		CodecName string `json:"codec_name"`
		PixFmt    string `json:"pix_fmt"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
	} `json:"streams"`
}

// VideoCompatibility giữ riêng ba điều kiện tương thích. Không gộp chúng thành
// một bool vì mỗi điều kiện sai có cách sửa rẻ hơn và ít làm giảm chất lượng hơn.
type VideoCompatibility struct {
	ContainerOK bool
	// MetadataOK is deliberately independent even though the current browser
	// profile has no extra metadata restriction. Keeping it explicit avoids
	// collapsing future MP4 metadata repairs into a vague "invalid" state.
	MetadataOK bool
	VideoOK    bool
	AudioOK    bool
	IsVideo    bool
	Width      int
	Height     int
}

func (c VideoCompatibility) IsCompatible() bool {
	return c.IsVideo && c.ContainerOK && c.MetadataOK && c.VideoOK && c.AudioOK
}

// VideoValidationResult is the structured result kept by the scanner. The
// three compatibility dimensions are intentionally independent: callers can
// remux, transcode audio, or transcode video without needlessly touching a
// stream which is already browser-compatible.
type VideoValidationResult struct {
	Path            string `json:"path"`
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	ResolutionClass string `json:"resolution_class"`
	IsVideo         bool   `json:"is_video"`
	ContainerOK     bool   `json:"container_ok"`
	MetadataOK      bool   `json:"metadata_ok"`
	VideoOK         bool   `json:"video_ok"`
	AudioOK         bool   `json:"audio_ok"`
}

func (c VideoCompatibility) Validation(path string) VideoValidationResult {
	return VideoValidationResult{
		Path: path, Width: c.Width, Height: c.Height, ResolutionClass: resolutionClass(c.Width, c.Height),
		IsVideo: c.IsVideo, ContainerOK: c.ContainerOK, MetadataOK: c.MetadataOK, VideoOK: c.VideoOK, AudioOK: c.AudioOK,
	}
}

// resolutionClass never infers a resolution from the filename and never
// offers an upscale. 4K begins at a 3840-pixel long edge; 2K begins at 2560;
// everything below that is treated as 1080p-or-lower.
func resolutionClass(width, height int) string {
	longEdge := width
	if height > longEdge {
		longEdge = height
	}
	switch {
	case longEdge >= 3840:
		return "4k"
	case longEdge >= 2560:
		return "2k"
	default:
		return "1080p_or_lower"
	}
}

// probeVideoCompatibility chỉ đọc metadata. Container, video và audio được
// trả độc lập để chọn remux/copy/transcode đúng phần cần thiết.
func probeVideoCompatibility(path string) VideoCompatibility {
	return probeVideoCompatibilityContext(context.Background(), path)
}

func probeVideoCompatibilityContext(parent context.Context, path string) VideoCompatibility {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries",
		"format=format_name:stream=codec_type,codec_name,pix_fmt,width,height", "-of", "json", path)
	out, err := cmd.Output()
	if err != nil {
		LogInfo("[CONVERT] Không thể đọc metadata video %s: %v", filepath.Base(path), err)
		return VideoCompatibility{IsVideo: true} // file có đuôi video nhưng lỗi: full transcode
	}

	var media ffprobeMedia
	if err := json.Unmarshal(out, &media); err != nil {
		LogInfo("[CONVERT] Metadata video không hợp lệ %s: %v", filepath.Base(path), err)
		return VideoCompatibility{IsVideo: true}
	}

	// ffprobe gọi MP4/MOV là "mov,mp4,m4a,3gp,3g2,mj2".
	result := VideoCompatibility{
		ContainerOK: strings.Contains(media.Format.FormatName, "mov") || strings.Contains(media.Format.FormatName, "mp4"),
		MetadataOK:  true,
		AudioOK:     true, // video không có audio vẫn phát được
	}
	for _, stream := range media.Streams {
		switch stream.CodecType {
		case "video":
			result.IsVideo = true
			result.Width, result.Height = stream.Width, stream.Height
			if stream.CodecName == "h264" && (stream.PixFmt == "yuv420p" || stream.PixFmt == "yuvj420p") {
				result.VideoOK = true
			}
		case "audio":
			if stream.CodecName != "aac" {
				result.AudioOK = false
			}
		}
	}
	return result
}

// VideoOptimization is the durable, public-safe record for one scanned video.
// RelativePath and ID are stable across Storage/Coordinator restarts; never
// expose the SSD workspace's absolute path outside Storage.
type VideoOptimization struct {
	ID                 string   `json:"id"`
	RelativePath       string   `json:"relativePath"`
	DisplayName        string   `json:"displayName"`
	Width              int      `json:"width"`
	Height             int      `json:"height"`
	ResolutionClass    string   `json:"resolutionClass"`
	SourceSizeBytes    int64    `json:"sourceSizeBytes"`
	ContainerOK        bool     `json:"containerCompatible"`
	MetadataOK         bool     `json:"metadataCompatible"`
	VideoOK            bool     `json:"videoCompatible"`
	AudioOK            bool     `json:"audioCompatible"`
	OptimizationNeeded bool     `json:"optimizationRequired"`
	AllowedQualities   []string `json:"allowedQualities,omitempty"`
	SelectedQuality    string   `json:"selectedQuality,omitempty"`
	State              string   `json:"state"`
	Error              string   `json:"error,omitempty"`
}

func videoID(relativePath string) string {
	sum := sha256.Sum256([]byte(filepath.ToSlash(relativePath)))
	return fmt.Sprintf("video-%x", sum[:12])
}

func allowedQualities(class string) []string {
	switch class {
	case "4k":
		return []string{"4k", "2k", "1080p"}
	case "2k":
		return []string{"2k", "1080p"}
	default:
		return nil
	}
}

// ScanVideoOptimizations performs one metadata scan and derives all canonical
// UI/conversion data. The caller persists the result and does not re-ffprobe
// it for history GETs.
func ScanVideoOptimizations(ctx context.Context, folderPath string) []VideoOptimization {
	validations := ScanVideoValidationContext(ctx, folderPath)
	items := make([]VideoOptimization, 0, len(validations))
	for _, validation := range validations {
		rel, err := filepath.Rel(folderPath, validation.Path)
		if err != nil || strings.HasPrefix(rel, "..") {
			continue
		}
		info, _ := os.Stat(validation.Path)
		size := int64(0)
		if info != nil {
			size = info.Size()
		}
		needed := validation.IsVideo && !(validation.ContainerOK && validation.MetadataOK && validation.VideoOK && validation.AudioOK)
		qualities := allowedQualities(validation.ResolutionClass)
		item := VideoOptimization{ID: videoID(rel), RelativePath: filepath.ToSlash(rel), DisplayName: filepath.Base(rel), Width: validation.Width, Height: validation.Height, ResolutionClass: validation.ResolutionClass, SourceSizeBytes: size, ContainerOK: validation.ContainerOK, MetadataOK: validation.MetadataOK, VideoOK: validation.VideoOK, AudioOK: validation.AudioOK, OptimizationNeeded: needed, AllowedQualities: qualities, State: "compatible"}
		if needed {
			item.State = "decision_required"
			if len(qualities) == 0 {
				item.SelectedQuality, item.State = "preserve", "ready"
			}
		}
		items = append(items, item)
	}
	return items
}

// ScanVideoValidation recursively validates every file with a known video
// extension. It is the authoritative scan used before conversion; image and
// archive files are filtered by extension before ffprobe is invoked.
func ScanVideoValidationContext(ctx context.Context, folderPath string) []VideoValidationResult {
	var results []VideoValidationResult
	_ = filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if ctx.Err() != nil {
			return context.Canceled
		}
		if err != nil {
			return nil
		}
		if info.IsDir() {
			name := info.Name()
			if strings.HasPrefix(name, ".") || name == "original-video" || name == ".original-video" {
				if name == ".convert-video" {
					_ = os.RemoveAll(path)
				}
				return filepath.SkipDir
			}
		}
		if info.IsDir() || strings.HasPrefix(info.Name(), ".") || !videoExtensions[strings.ToLower(filepath.Ext(info.Name()))] {
			return nil
		}
		compatibility := probeVideoCompatibilityContext(ctx, path)
		results = append(results, compatibility.Validation(path))
		return nil
	})
	return results
}

// isBrowserCompatibleVideo chỉ chấp nhận tập an toàn chung cho Safari, iOS và
// Chromium: MP4/MOV chứa H.264 yuv420p và AAC (hoặc không có audio). Không dựa
// vào phần mở rộng vì .mp4 vẫn có thể chứa HEVC, VP9 hay audio không hỗ trợ.
func isBrowserCompatibleVideo(path string) (compatible bool, isVideo bool) {
	result := probeVideoCompatibility(path)
	return result.IsCompatible(), result.IsVideo
}

// ScanIncompatibleVideos quét đệ quy cả thư mục con, kiểm tra container và
// codec thực tế của từng video trước khi quyết định có cần convert hay không.
func ScanIncompatibleVideos(folderPath string) []string {
	return ScanIncompatibleVideosContext(context.Background(), folderPath)
}

func ScanIncompatibleVideosContext(ctx context.Context, folderPath string) []string {
	validations := ScanVideoValidationContext(ctx, folderPath)
	found := make([]string, 0, len(validations))
	for _, validation := range validations {
		if validation.IsVideo && !(validation.ContainerOK && validation.VideoOK && validation.AudioOK) {
			found = append(found, validation.Path)
		}
	}
	return found
}

// StartConvertJob scan thư mục trước, nếu có video không hợp lệ thì khởi chạy convert ngầm.
// Trả về số lượng video không hợp lệ tìm được (0 nếu không có gì cần convert).
func StartConvertJob(taskID string, folderPath string) int {
	return StartConvertJobWithContext(context.Background(), taskID, folderPath)
}

// StartConvertJobWithContext cho archive job truyền context xuyên suốt. Khi
// archive bị cancel, việc quét và ffmpeg convert đều dừng cùng lúc.
func StartConvertJobWithContext(parent context.Context, taskID string, folderPath string) int {
	invalid, _ := StartConvertJobWithContextSummary(parent, taskID, folderPath)
	return invalid
}

// StartConvertJobWithContextSummary additionally returns the number of video
// candidates scanned so archive history can distinguish no videos from all
// videos already valid.
func StartConvertJobWithContextSummary(parent context.Context, taskID string, folderPath string) (int, int) {
	return StartConvertJobWithContextPlans(parent, taskID, folderPath, nil)
}

// StartConvertJobWithContextPlans uses persisted per-video choices. A nil plan
// retains the legacy scanner behavior for callers outside the archive flow.
func StartConvertJobWithContextPlans(parent context.Context, taskID string, folderPath string, plans map[string]string) (int, int) {
	LogInfo("[CONVERT] [%s] Bắt đầu quét thư mục: %s", taskID, folderPath)
	if parent.Err() != nil {
		return 0, 0
	}
	validations := ScanVideoValidationContext(parent, folderPath)
	if parent.Err() != nil {
		LogInfo("[CONVERT] [%s] Đã hủy khi đang quét thư mục.", taskID)
		return 0, 0
	}
	files := make([]string, 0, len(validations))
	for _, validation := range validations {
		if validation.IsVideo && !(validation.ContainerOK && validation.MetadataOK && validation.VideoOK && validation.AudioOK) {
			if plans != nil {
				rel, err := filepath.Rel(folderPath, validation.Path)
				if err != nil || plans[filepath.ToSlash(rel)] == "" {
					continue
				}
			}
			files = append(files, validation.Path)
		}
	}
	total := len(files)

	if total == 0 {
		LogInfo("[CONVERT] [%s] Không tìm thấy video không hợp lệ trong thư mục.", taskID)
		return 0, len(validations)
	}

	LogInfo("[CONVERT] [%s] Tìm thấy %d video không hợp lệ. Khởi chạy convert ngầm...", taskID, total)

	ctx, cancel := context.WithCancel(parent)
	job := &ConvertJob{
		TaskID:    taskID,
		Total:     total,
		Current:   0,
		Done:      false,
		ctx:       ctx,
		cancel:    cancel,
		Qualities: make(map[string]string),
	}
	if plans != nil {
		for path, quality := range plans {
			job.Qualities[filepath.Clean(path)] = quality
		}
	}
	convertJobsMu.Lock()
	convertJobs[taskID] = job
	convertJobsMu.Unlock()

	go func() {
		defer func() {
			job.mu.Lock()
			job.Done = true
			job.CurrentPercent = 100
			failed := job.Failed
			job.mu.Unlock()
			if failed > 0 {
				LogInfo("[CONVERT] [%s] Kết thúc với %d/%d video lỗi.", taskID, failed, total)
			} else {
				LogInfo("[CONVERT] [%s] Hoàn tất tất cả %d video.", taskID, total)
			}
			time.AfterFunc(5*time.Minute, func() { deleteConvertJob(taskID) })
		}()

		// Dọn dẹp thư mục .convert-video lỗi thời nếu có
		_ = os.RemoveAll(filepath.Join(folderPath, ".convert-video"))

		// Scan có thể hoàn tất đồng thời, nhưng ffmpeg phải xếp hàng theo từng
		// archive job để không xen kẽ video giữa hai thư mục và không tràn RAM.
		if len(convertJobSemaphore) > 0 {
			LogInfo("[CONVERT] [%s] Đang chờ archive job khác convert xong.", taskID)
		}
		select {
		case convertJobSemaphore <- struct{}{}:
			LogInfo("[CONVERT] [%s] Nhận lượt convert độc quyền (%d video).", taskID, total)
		case <-job.ctx.Done():
			LogInfo("[CONVERT] [%s] Hủy khi đang chờ lượt convert.", taskID)
			return
		}
		defer func() { <-convertJobSemaphore }()

		// Di chuyển thư mục cũ original-video sang .original-video nếu có
		MigrateLegacyOriginalVideoDir(folderPath)

		// Bảo tồn trước tất cả video gốc vào .original-video/ trước khi chạy encode.
		// Giữ nguyên đường dẫn con cho video lồng nhau, không bao giờ ghi đè file có sẵn.
		type convertItem struct {
			originalPath string
			finalPath    string
			relPath      string
		}
		items := make([]convertItem, 0, len(files))
		for _, srcPath := range files {
			rel, err := filepath.Rel(folderPath, srcPath)
			if err != nil {
				continue
			}
			originalPath := filepath.Join(folderPath, ".original-video", rel)
			if err := os.MkdirAll(filepath.Dir(originalPath), 0755); err != nil {
				LogInfo("[CONVERT] [%s] Không tạo được thư mục .original-video: %v", taskID, err)
			}
			if _, statErr := os.Stat(originalPath); os.IsNotExist(statErr) {
				if renameErr := os.Rename(srcPath, originalPath); renameErr != nil {
					if copyErr := copyFile(srcPath, originalPath); copyErr == nil {
						_ = os.Remove(srcPath)
					} else {
						LogInfo("[CONVERT] [%s] Lỗi bảo tồn video nguồn sang %s: %v", taskID, originalPath, copyErr)
					}
				}
			}
			finalRel := strings.TrimSuffix(rel, filepath.Ext(rel)) + ".mp4"
			finalPath := filepath.Join(folderPath, finalRel)
			items = append(items, convertItem{
				originalPath: originalPath,
				finalPath:    finalPath,
				relPath:      rel,
			})
		}

		for i, item := range items {
			if job.ctx.Err() != nil {
				LogInfo("[CONVERT] [%s] Dừng convert theo yêu cầu hủy.", taskID)
				break
			}
			idx := i + 1

			job.mu.Lock()
			job.CurrentName = filepath.Base(item.originalPath)
			job.CurrentPercent = 0
			job.mu.Unlock()

			stagedPath := item.finalPath + ".tmp.mp4"
			_ = os.Remove(stagedPath)

			LogInfo("[CONVERT] [%s] [%d/%d] Bắt đầu convert: %s", taskID, idx, total, filepath.Base(item.originalPath))

			compatibility := probeVideoCompatibility(item.originalPath)
			quality := job.Qualities[filepath.Clean(filepath.ToSlash(item.relPath))]
			if !convertSingleFile(job, taskID, item.originalPath, stagedPath, idx, total, compatibility, quality) {
				_ = os.Remove(stagedPath)
				if job.ctx.Err() == nil {
					job.mu.Lock()
					job.Failed++
					job.mu.Unlock()
				}
			} else if job.ctx.Err() != nil {
				_ = os.Remove(stagedPath)
				break
			} else if err := publishConvertedVideo(stagedPath, item.finalPath); err != nil {
				LogInfo("[CONVERT] [%s] [%d/%d] Không thể đưa video đã convert ra ngoài: %v", taskID, idx, total, err)
				job.mu.Lock()
				job.Failed++
				job.mu.Unlock()
			}
			if job.ctx.Err() != nil {
				break
			}

			// API polling uses Current as "files already processed", not the
			// file that merely started. Python therefore broadcasts [1/N], [2/N]
			// only after Go has finished each individual file.
			job.mu.Lock()
			job.Current = idx
			job.CurrentPercent = 100
			job.mu.Unlock()
		}
	}()

	return total, len(validations)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func cleanIncompleteOutputs(folder string) {
	_ = filepath.Walk(folder, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			name := info.Name()
			if strings.HasSuffix(name, ".tmp.mp4") || strings.HasSuffix(name, ".appview-copying") {
				_ = os.Remove(path)
			}
		}
		return nil
	})
}

// MigrateLegacyOriginalVideoDir di chuyển an toàn thư mục cũ original-video sang .original-video.
func MigrateLegacyOriginalVideoDir(folderPath string) {
	legacyDir := filepath.Join(folderPath, "original-video")
	targetDir := filepath.Join(folderPath, ".original-video")
	info, err := os.Stat(legacyDir)
	if err != nil || !info.IsDir() {
		return
	}
	if _, targetErr := os.Stat(targetDir); os.IsNotExist(targetErr) {
		if renameErr := os.Rename(legacyDir, targetDir); renameErr == nil {
			LogInfo("[CONVERT] Đã chuyển thư mục cũ original-video sang .original-video: %s", folderPath)
			return
		}
	}
	_ = filepath.Walk(legacyDir, func(path string, fi os.FileInfo, walkErr error) error {
		if walkErr != nil || path == legacyDir {
			return nil
		}
		rel, err := filepath.Rel(legacyDir, path)
		if err != nil {
			return nil
		}
		destPath := filepath.Join(targetDir, rel)
		if fi.IsDir() {
			return os.MkdirAll(destPath, 0755)
		}
		if _, destStat := os.Stat(destPath); os.IsNotExist(destStat) {
			if renameErr := os.Rename(path, destPath); renameErr != nil {
				if copyErr := copyFile(path, destPath); copyErr == nil {
					_ = os.Remove(path)
				}
			}
		}
		return nil
	})
	_ = os.RemoveAll(legacyDir)
}

// publishConvertedVideo xác thực định dạng file đã convert và đổi tên nguyên tử về vị trí đích.
// Video gốc vẫn an toàn dưới .original-video/ và không bao giờ bị xóa.
func publishConvertedVideo(stagedPath, finalPath string) error {
	defer os.Remove(stagedPath)
	compatible, _ := isBrowserCompatibleVideo(stagedPath)
	if !compatible {
		return fmt.Errorf("file convert không đạt định dạng tương thích")
	}
	if err := os.MkdirAll(filepath.Dir(finalPath), 0755); err != nil {
		return fmt.Errorf("không thể tạo thư mục đích: %w", err)
	}
	if err := os.Rename(stagedPath, finalPath); err != nil {
		return fmt.Errorf("không thể chuyển file đã convert: %w", err)
	}
	return nil
}

// ConvertFolderVideos giữ nguyên để không break code cũ.
func ConvertFolderVideos(folderPath string) {
	StartConvertJob(folderPath, folderPath)
}

// ConvertSingleVideoFile performs direct single-file transcoding from srcPath to dstPath.
// It registers a ConvertJob for taskID so cancellation via CancelConvertJob is supported.
func ConvertSingleVideoFile(parent context.Context, taskID, srcPath, dstPath, quality string) error {
	LogInfo("[CONVERT] [%s] Bắt đầu convert single video: %s -> %s (quality: %s)", taskID, srcPath, dstPath, quality)
	if parent.Err() != nil {
		return parent.Err()
	}

	if _, err := os.Stat(srcPath); err != nil {
		return fmt.Errorf("không tìm thấy file nguồn: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return fmt.Errorf("không thể tạo thư mục đích cho file convert: %w", err)
	}

	ctx, cancel := context.WithCancel(parent)
	job := &ConvertJob{
		TaskID:         taskID,
		Total:          1,
		Current:        0,
		CurrentName:    filepath.Base(srcPath),
		CurrentPercent: 0,
		Done:           false,
		ctx:            ctx,
		cancel:         cancel,
		Qualities:      map[string]string{filepath.Base(srcPath): quality},
	}
	convertJobsMu.Lock()
	convertJobs[taskID] = job
	convertJobsMu.Unlock()
	defer func() {
		job.mu.Lock()
		job.Done = true
		job.mu.Unlock()
		time.AfterFunc(5*time.Minute, func() { deleteConvertJob(taskID) })
	}()

	if len(convertJobSemaphore) > 0 {
		LogInfo("[CONVERT] [%s] Đang chờ convert job khác hoàn thành.", taskID)
	}
	select {
	case convertJobSemaphore <- struct{}{}:
		LogInfo("[CONVERT] [%s] Nhận lượt convert độc quyền cho single file: %s", taskID, filepath.Base(srcPath))
	case <-job.ctx.Done():
		LogInfo("[CONVERT] [%s] Hủy khi đang chờ lượt convert.", taskID)
		return job.ctx.Err()
	}
	defer func() { <-convertJobSemaphore }()

	compatibility := probeVideoCompatibilityContext(job.ctx, srcPath)
	if job.ctx.Err() != nil {
		return job.ctx.Err()
	}

	_ = os.Remove(dstPath)
	ok := convertSingleFile(job, taskID, srcPath, dstPath, 1, 1, compatibility, quality)
	if !ok {
		_ = os.Remove(dstPath)
		if job.ctx.Err() != nil {
			return job.ctx.Err()
		}
		return fmt.Errorf("chuyển đổi ffmpeg thất bại cho %s", filepath.Base(srcPath))
	}
	if job.ctx.Err() != nil {
		_ = os.Remove(dstPath)
		return job.ctx.Err()
	}

	compatible, _ := isBrowserCompatibleVideo(dstPath)
	if !compatible {
		_ = os.Remove(dstPath)
		return fmt.Errorf("file convert không đạt định dạng tương thích trình duyệt")
	}

	job.mu.Lock()
	job.Current = 1
	job.CurrentPercent = 100
	job.mu.Unlock()
	LogInfo("[CONVERT] [%s] Hoàn tất convert single video: %s", taskID, filepath.Base(dstPath))
	return nil
}

// convertSingleFile chọn đúng nhánh nhỏ nhất. Ba thuộc tính độc lập cho phép
// giữ nguyên stream đã đạt thay vì luôn encode lại cả video lẫn audio.
func convertSingleFile(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int, c VideoCompatibility, quality string) bool {
	// A selected downscale necessarily re-encodes video, while still copying
	// compatible audio whenever the MP4 container allows it.
	quality = strings.ToLower(strings.TrimSpace(quality))
	if _, ok := map[string]bool{
		"4k": true, "2k": true, "1080p": true,
		"720p": true, "480p": true, "360p": true, "240p": true, "144p": true,
	}[quality]; ok {
		return transcodeVideoOnlyQuality(job, taskID, srcPath, dstPath, idx, total, quality)
	}
	switch {
	case c.VideoOK && c.AudioOK:
		return remuxContainer(job, taskID, srcPath, dstPath, idx, total)
	case c.VideoOK:
		return transcodeAudioOnly(job, taskID, srcPath, dstPath, idx, total)
	case c.AudioOK:
		return transcodeVideoOnly(job, taskID, srcPath, dstPath, idx, total)
	default:
		return transcodeVideoOnly(job, taskID, srcPath, dstPath, idx, total)
	}
}

func transcodeVideoOnlyQuality(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int, quality string) bool {
	ok := runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264 "+quality, append(browserVideoArgs(quality), "-map", "0:a?", "-c:a", "copy", "-movflags", "+faststart", "-brand", "mp42"))
	if !ok && job.ctx.Err() == nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Audio stream copy không thành công hoặc không tương thích, chuyển sang AAC fallback", taskID, idx, total)
		return transcodeVideoAndAudioQuality(job, taskID, srcPath, dstPath, idx, total, quality)
	}
	return ok
}

func transcodeVideoAndAudioQuality(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int, quality string) bool {
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264 + audio AAC "+quality, append(browserVideoArgs(quality), "-map", "0:a?", "-c:a", "aac", "-profile:a", "aac_low", "-ar", "48000", "-b:a", "192k", "-movflags", "+faststart", "-brand", "mp42"))
}

func remuxContainer(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Chỉ đổi container sang MP4, giữ nguyên video/audio: %s", taskID, idx, total, filepath.Base(srcPath))
	ok := runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "remux container", []string{
		"-map", "0:v:0", "-map", "0:a?", "-c", "copy",
		"-movflags", "+faststart", "-brand", "mp42",
	})
	if !ok && job.ctx.Err() == nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Remux thất bại, fallback sang transcode", taskID, idx, total)
		return transcodeVideoAndAudio(job, taskID, srcPath, dstPath, idx, total)
	}
	return ok
}

func transcodeAudioOnly(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Chỉ tối ưu audio sang AAC, giữ nguyên video: %s", taskID, idx, total, filepath.Base(srcPath))
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "audio AAC", []string{
		"-map", "0:v:0", "-map", "0:a?", "-c:v", "copy",
		"-c:a", "aac", "-profile:a", "aac_low", "-ar", "48000", "-b:a", "192k",
		"-movflags", "+faststart", "-brand", "mp42",
	})
}

func transcodeVideoOnly(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Chỉ tối ưu video H.264, giữ nguyên audio: %s", taskID, idx, total, filepath.Base(srcPath))
	ok := runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264", append(browserVideoArgs(""),
		"-map", "0:a?", "-c:a", "copy", "-movflags", "+faststart", "-brand", "mp42",
	))
	if !ok && job.ctx.Err() == nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Audio stream copy không thành công hoặc không tương thích, chuyển sang AAC fallback", taskID, idx, total)
		return transcodeVideoAndAudio(job, taskID, srcPath, dstPath, idx, total)
	}
	return ok
}

func transcodeVideoAndAudio(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Tối ưu video H.264 và audio AAC: %s", taskID, idx, total, filepath.Base(srcPath))
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264 + audio AAC", append(browserVideoArgs(""),
		"-map", "0:a?", "-c:a", "aac", "-profile:a", "aac_low", "-ar", "48000", "-b:a", "192k",
		"-movflags", "+faststart", "-brand", "mp42",
	))
}

func browserVideoArgs(quality string) []string {
	args := []string{
		"-map", "0:v:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "2",
		"-profile:v", "high", "-level:v", "5.1", "-pix_fmt", "yuv420p", "-tag:v", "avc1",
	}
	quality = strings.ToLower(strings.TrimSpace(quality))
	targetMap := map[string]int{
		"4k":    2160,
		"2k":    1440,
		"1080p": 1080,
		"720p":  720,
		"480p":  480,
		"360p":  360,
		"240p":  240,
		"144p":  144,
	}
	if target := targetMap[quality]; target > 0 {
		args = append(args, "-vf", fmt.Sprintf("scale='if(gte(iw,ih),-2,%d)':'if(gte(iw,ih),%d,-2)':force_original_aspect_ratio=decrease", target, target))
	}
	return args
}

// runFFmpegConversion dùng chung logging, progress nguyên %, timeout và publish
// file staging; các hàm trên chỉ chịu trách nhiệm chọn codec cho stream cần sửa.
func runFFmpegConversion(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int, operation string, args []string) bool {
	tempPath := strings.TrimSuffix(dstPath, ".mp4") + ".tmp.mp4"
	_ = os.Remove(tempPath)
	ctx, cancel := context.WithTimeout(job.ctx, 12*time.Hour)
	defer cancel()
	duration := getVideoDurationSeconds(srcPath)

	pipeRead, pipeWrite, err := os.Pipe()
	if err != nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Lỗi tạo pipe: %v", taskID, idx, total, err)
		return false
	}
	args = append([]string{"-y", "-i", srcPath}, args...)
	args = append(args, "-progress", "pipe:3", "-nostats", tempPath)
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.ExtraFiles = []*os.File{pipeWrite}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Lỗi start %s: %v %s", taskID, idx, total, operation, err, trimFFmpegError(stderr.String()))
		_ = pipeRead.Close()
		_ = pipeWrite.Close()
		return false
	}
	_ = pipeWrite.Close()
	go watchFFmpegProgress(pipeRead, job, taskID, srcPath, idx, total, duration)

	if err := cmd.Wait(); err != nil {
		if job.ctx.Err() != nil {
			LogInfo("[CONVERT] [%s] [%d/%d] Đã dừng %s theo yêu cầu hủy.", taskID, idx, total, operation)
			_ = os.Remove(tempPath)
			return false
		}
		LogInfo("[CONVERT] [%s] [%d/%d] Lỗi %s %s: %v %s", taskID, idx, total, operation, filepath.Base(srcPath), err, trimFFmpegError(stderr.String()))
		_ = os.Remove(tempPath)
		return false
	}
	if fi, statErr := os.Stat(tempPath); statErr != nil || fi.Size() == 0 {
		_ = os.Remove(tempPath)
		LogInfo("[CONVERT] [%s] [%d/%d] %s thất bại (output rỗng): %s", taskID, idx, total, operation, filepath.Base(srcPath))
		return false
	}
	if err := os.Rename(tempPath, dstPath); err != nil {
		LogInfo("[CONVERT] [%s] [%d/%d] Không đổi tên output %s: %v", taskID, idx, total, operation, err)
		return false
	}
	job.mu.Lock()
	job.CurrentPercent = 100
	job.mu.Unlock()
	LogInfo("[CONVERT] [%s] [%d/%d] Hoàn tất %s: %s", taskID, idx, total, operation, filepath.Base(dstPath))
	return true
}

func watchFFmpegProgress(pipeRead *os.File, job *ConvertJob, taskID, srcPath string, idx, total int, duration float64) {
	defer pipeRead.Close()
	scanner := bufio.NewScanner(pipeRead)
	var outTimeUs int64
	lastLoggedPercent := -1
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "out_time_us=") {
			if value, err := strconv.ParseInt(strings.TrimPrefix(line, "out_time_us="), 10, 64); err == nil && value >= 0 {
				outTimeUs = value
			}
		}
		if strings.HasPrefix(line, "progress=") && duration > 0 {
			percent := int(min(100, float64(outTimeUs)/1e6/duration*100))
			job.mu.Lock()
			job.CurrentPercent = float64(percent)
			job.mu.Unlock()
			if percent > lastLoggedPercent {
				LogInfo("[CONVERT] [%s] [%d/%d] %s %d%%", taskID, idx, total, filepath.Base(srcPath), percent)
				lastLoggedPercent = percent
			}
		}
	}
}

func trimFFmpegError(stderr string) string {
	stderr = strings.TrimSpace(stderr)
	const maxLen = 1200
	if len(stderr) > maxLen {
		return stderr[len(stderr)-maxLen:]
	}
	return stderr
}

func getVideoDurationSeconds(path string) float64 {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet", "-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1", path)
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	d, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0
	}
	return d
}
