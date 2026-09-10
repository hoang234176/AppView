package youtube

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

func downloadStream(ctx context.Context, job *Job, targetURL string, headers map[string]string, partPath string, initialBytes int64) (int64, error) {
	var existingBytes int64
	if info, statErr := os.Stat(partPath); statErr == nil {
		existingBytes = info.Size()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return 0, err
	}

	for k, v := range headers {
		lk := strings.ToLower(k)
		if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" {
			req.Header.Set(k, v)
		}
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
	}
	if existingBytes > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", existingBytes))
	}

	client := &http.Client{Timeout: 0}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("máy chủ tải trả HTTP %d", resp.StatusCode)
	}

	appendMode := existingBytes > 0 && resp.StatusCode == http.StatusPartialContent
	if existingBytes > 0 && !appendMode {
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
		return 0, err
	}
	defer file.Close()

	job.mu.Lock()
	job.DownloadedBytes = initialBytes + existingBytes
	if resp.ContentLength > 0 {
		job.TotalBytes = job.DownloadedBytes + resp.ContentLength
	}
	job.mu.Unlock()

	buffer := make([]byte, 1024*1024)
	lastBytes := job.DownloadedBytes
	lastTime := time.Now()

	for {
		if ctx.Err() != nil {
			return existingBytes, ctx.Err()
		}

		count, readErr := resp.Body.Read(buffer)
		if count > 0 {
			if _, wErr := file.Write(buffer[:count]); wErr != nil {
				return existingBytes, wErr
			}
			existingBytes += int64(count)

			shouldPersist := false
			job.mu.Lock()
			job.DownloadedBytes += int64(count)
			now := time.Now()
			elapsed := now.Sub(lastTime).Seconds()
			if elapsed >= 0.5 {
				job.SpeedBytes = int64(float64(job.DownloadedBytes-lastBytes) / elapsed)
				lastBytes = job.DownloadedBytes
				lastTime = now
				job.UpdatedAt = now.UTC()
				shouldPersist = true
			}
			job.mu.Unlock()

			if shouldPersist {
				persistJob(job)
			}
		}

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return existingBytes, readErr
		}
	}

	return existingBytes, file.Close()
}

func muxVideoAudio(ctx context.Context, videoPart, audioPart, outputPath string) error {
	_ = os.Remove(outputPath)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-i", videoPart, "-i", audioPart, "-c", "copy", "-movflags", "+faststart", outputPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("ghép video/audio thất bại: %s", strings.TrimSpace(string(output)))
	}
	return nil
}
