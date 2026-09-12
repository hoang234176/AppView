package facebook

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/cookies"
)

func netscapeToCookieHeader(raw string) string {
	lines := strings.Split(raw, "\n")
	var parts []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) >= 7 {
			name := strings.TrimSpace(fields[5])
			val := strings.TrimSpace(fields[6])
			if name != "" && val != "" {
				parts = append(parts, fmt.Sprintf("%s=%s", name, val))
			}
		}
	}
	return strings.Join(parts, "; ")
}

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
		if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" || lk == "cookie" {
			req.Header.Set(k, v)
		}
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
	}
	if req.Header.Get("Referer") == "" {
		req.Header.Set("Referer", "https://www.facebook.com/")
	}
	if req.Header.Get("Cookie") == "" {
		if raw, exists, err := cookies.Read("facebook"); err == nil && exists && strings.TrimSpace(raw) != "" {
			cookieHeader := netscapeToCookieHeader(raw)
			if cookieHeader != "" {
				req.Header.Set("Cookie", cookieHeader)
			}
		}
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
			job.DownloadedBytes = initialBytes + existingBytes
			now := time.Now()
			elapsed := now.Sub(lastTime)
			if elapsed >= time.Second {
				delta := job.DownloadedBytes - lastBytes
				job.SpeedBytes = int64(float64(delta) / elapsed.Seconds())
				lastBytes = job.DownloadedBytes
				lastTime = now
				shouldPersist = true
			}
			job.mu.Unlock()

			if shouldPersist {
				persistJob(job)
			}
		}

		if readErr != nil {
			if readErr.Error() == "EOF" {
				break
			}
			return existingBytes, readErr
		}
	}

	job.mu.Lock()
	job.DownloadedBytes = initialBytes + existingBytes
	job.SpeedBytes = 0
	job.mu.Unlock()
	persistJob(job)
	return existingBytes, nil
}

func downloadAllItems(ctx context.Context, job *Job, workspace string) error {
	job.mu.RLock()
	items := job.items
	headers := job.headers
	singleURL := job.URL
	singleFilename := job.Filename
	job.mu.RUnlock()

	if len(items) > 0 {
		var totalDownloaded int64
		for _, item := range items {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			destFile := filepath.Join(workspace, item.Filename)
			partFile := destFile + ".part"
			downloaded, err := downloadStream(ctx, job, item.URL, headers, partFile, totalDownloaded)
			if err != nil {
				return err
			}
			totalDownloaded += downloaded
			_ = os.Rename(partFile, destFile)
		}
		return nil
	}

	// Single media file download (video)
	destFile := filepath.Join(workspace, singleFilename)
	partFile := destFile + ".part"
	_, err := downloadStream(ctx, job, singleURL, headers, partFile, 0)
	if err != nil {
		return err
	}
	return os.Rename(partFile, destFile)
}
