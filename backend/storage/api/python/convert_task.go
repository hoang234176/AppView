package pythonapi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	} `json:"streams"`
}

// VideoCompatibility giữ riêng ba điều kiện tương thích. Không gộp chúng thành
// một bool vì mỗi điều kiện sai có cách sửa rẻ hơn và ít làm giảm chất lượng hơn.
type VideoCompatibility struct {
	ContainerOK bool
	VideoOK     bool
	AudioOK     bool
	IsVideo     bool
}

func (c VideoCompatibility) IsCompatible() bool {
	return c.IsVideo && c.ContainerOK && c.VideoOK && c.AudioOK
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
		"format=format_name:stream=codec_type,codec_name,pix_fmt", "-of", "json", path)
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
		AudioOK:     true, // video không có audio vẫn phát được
	}
	for _, stream := range media.Streams {
		switch stream.CodecType {
		case "video":
			result.IsVideo = true
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
	var found []string
	_ = filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if ctx.Err() != nil {
			return context.Canceled
		}
		if err != nil {
			return nil
		}
		if info.IsDir() && strings.HasPrefix(info.Name(), ".") {
			return filepath.SkipDir
		}
		if info.IsDir() || strings.HasPrefix(info.Name(), ".") {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(info.Name()))
		if !videoExtensions[ext] {
			return nil
		}
		compatibility := probeVideoCompatibilityContext(ctx, path)
		if compatibility.IsVideo && !compatibility.IsCompatible() {
			found = append(found, path)
		}
		return nil
	})
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
	LogInfo("[CONVERT] [%s] Bắt đầu quét thư mục: %s", taskID, folderPath)
	if parent.Err() != nil {
		return 0
	}
	files := ScanIncompatibleVideosContext(parent, folderPath)
	if parent.Err() != nil {
		LogInfo("[CONVERT] [%s] Đã hủy khi đang quét thư mục.", taskID)
		return 0
	}
	total := len(files)

	if total == 0 {
		LogInfo("[CONVERT] [%s] Không tìm thấy video không hợp lệ trong thư mục.", taskID)
		return 0
	}

	LogInfo("[CONVERT] [%s] Tìm thấy %d video không hợp lệ. Khởi chạy convert ngầm...", taskID, total)

	ctx, cancel := context.WithCancel(parent)
	job := &ConvertJob{
		TaskID:  taskID,
		Total:   total,
		Current: 0,
		Done:    false,
		ctx:     ctx,
		cancel:  cancel,
	}
	convertJobsMu.Lock()
	convertJobs[taskID] = job
	convertJobsMu.Unlock()

	go func() {
		stagingDirs := make(map[string]struct{})
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
			for dir := range stagingDirs {
				if err := os.Remove(dir); err != nil && !os.IsNotExist(err) {
					LogInfo("[CONVERT] [%s] Giữ lại thư mục tạm %s: %v", taskID, dir, err)
				}
			}
			time.AfterFunc(5*time.Minute, func() { deleteConvertJob(taskID) })
		}()

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

		for i, srcPath := range files {
			if job.ctx.Err() != nil {
				LogInfo("[CONVERT] [%s] Dừng convert theo yêu cầu hủy.", taskID)
				break
			}
			idx := i + 1

			job.mu.Lock()
			job.CurrentName = filepath.Base(srcPath)
			job.CurrentPercent = 0
			job.mu.Unlock()

			finalPath := strings.TrimSuffix(srcPath, filepath.Ext(srcPath)) + ".mp4"
			stagingDir := filepath.Join(filepath.Dir(srcPath), ".convert-video")
			stagedPath := filepath.Join(stagingDir, filepath.Base(finalPath))
			if err := os.MkdirAll(stagingDir, 0755); err != nil {
				LogInfo("[CONVERT] [%s] [%d/%d] Không tạo được thư mục tạm: %v", taskID, idx, total, err)
				job.mu.Lock()
				job.Failed++
				job.Current = idx // only expose this file after processing ended
				job.CurrentPercent = 100
				job.mu.Unlock()
				continue
			}
			stagingDirs[stagingDir] = struct{}{}
			_ = os.Remove(stagedPath)

			LogInfo("[CONVERT] [%s] [%d/%d] Bắt đầu convert: %s", taskID, idx, total, filepath.Base(srcPath))

			compatibility := probeVideoCompatibility(srcPath)
			if !convertSingleFile(job, taskID, srcPath, stagedPath, idx, total, compatibility) {
				if job.ctx.Err() == nil {
					job.mu.Lock()
					job.Failed++
					job.mu.Unlock()
				}
			} else if job.ctx.Err() != nil {
				break
			} else if err := publishConvertedVideo(srcPath, stagedPath, finalPath, stagingDir); err != nil {
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

	return total
}

// publishConvertedVideo thay thế nguồn bằng file đã convert một cách an toàn:
// di chuyển nguồn vào thư mục tạm, đưa MP4 ra vị trí cũ, sau đó xóa nguồn tạm.
func publishConvertedVideo(srcPath, stagedPath, finalPath, stagingDir string) error {
	compatible, _ := isBrowserCompatibleVideo(stagedPath)
	if !compatible {
		return fmt.Errorf("file convert không đạt định dạng tương thích")
	}
	backupPath := filepath.Join(stagingDir, "."+filepath.Base(srcPath)+".original")
	_ = os.Remove(backupPath)
	if err := os.Rename(srcPath, backupPath); err != nil {
		return fmt.Errorf("không thể di chuyển file nguồn: %w", err)
	}
	if err := os.Rename(stagedPath, finalPath); err != nil {
		_ = os.Rename(backupPath, srcPath)
		return fmt.Errorf("không thể chuyển file đã convert: %w", err)
	}
	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("không thể xóa file nguồn sau convert: %w", err)
	}
	return nil
}

// ConvertFolderVideos giữ nguyên để không break code cũ.
func ConvertFolderVideos(folderPath string) {
	StartConvertJob(folderPath, folderPath)
}

// convertSingleFile chọn đúng nhánh nhỏ nhất. Ba thuộc tính độc lập cho phép
// giữ nguyên stream đã đạt thay vì luôn encode lại cả video lẫn audio.
func convertSingleFile(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int, c VideoCompatibility) bool {
	switch {
	case c.VideoOK && c.AudioOK:
		return remuxContainer(job, taskID, srcPath, dstPath, idx, total)
	case c.VideoOK:
		return transcodeAudioOnly(job, taskID, srcPath, dstPath, idx, total)
	case c.AudioOK:
		return transcodeVideoOnly(job, taskID, srcPath, dstPath, idx, total)
	default:
		return transcodeVideoAndAudio(job, taskID, srcPath, dstPath, idx, total)
	}
}

func remuxContainer(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Chỉ đổi container sang MP4, giữ nguyên video/audio: %s", taskID, idx, total, filepath.Base(srcPath))
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "remux container", []string{
		"-map", "0:v:0", "-map", "0:a?", "-c", "copy",
		"-movflags", "+faststart", "-brand", "mp42",
	})
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
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264", append(browserVideoArgs(),
		"-map", "0:a?", "-c:a", "copy", "-movflags", "+faststart", "-brand", "mp42",
	))
}

func transcodeVideoAndAudio(job *ConvertJob, taskID, srcPath, dstPath string, idx, total int) bool {
	LogInfo("[CONVERT] [%s] [%d/%d] Tối ưu video H.264 và audio AAC: %s", taskID, idx, total, filepath.Base(srcPath))
	return runFFmpegConversion(job, taskID, srcPath, dstPath, idx, total, "video H.264 + audio AAC", append(browserVideoArgs(),
		"-map", "0:a?", "-c:a", "aac", "-profile:a", "aac_low", "-ar", "48000", "-b:a", "192k",
		"-movflags", "+faststart", "-brand", "mp42",
	))
}

func browserVideoArgs() []string {
	return []string{
		"-map", "0:v:0", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-threads", "2",
		"-profile:v", "high", "-level:v", "5.1", "-pix_fmt", "yuv420p", "-tag:v", "avc1",
	}
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
