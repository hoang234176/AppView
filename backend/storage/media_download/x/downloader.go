package x

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/cookies"
	"backend/multidownload"
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

func prepareXRequest(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		lk := strings.ToLower(k)
		if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" || lk == "cookie" || lk == "authorization" || lk == "x-csrf-token" {
			req.Header.Set(k, v)
		}
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
	}
	if req.Header.Get("Referer") == "" {
		req.Header.Set("Referer", "https://x.com/")
	}
	if req.Header.Get("Cookie") == "" {
		if raw, exists, err := cookies.Read("x"); err == nil && exists && strings.TrimSpace(raw) != "" {
			cookieHeader := netscapeToCookieHeader(raw)
			if cookieHeader != "" {
				req.Header.Set("Cookie", cookieHeader)
			}
		}
	}
}

func newJobProgressReporter(job *Job, initialBytes int64) *multidownload.ProgressReporter {
	return multidownload.NewProgressReporter(initialBytes, 500*time.Millisecond, func(downloaded, total, speed int64) {
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

		persistJob(job)
	})
}

func writeDataURL(dataURL, destPath string) error {
	// e.g. data:text/plain;charset=utf-8,content... or data:text/plain;base64,...
	commaIdx := strings.Index(dataURL, ",")
	if commaIdx == -1 {
		return fmt.Errorf("định dạng data URL không hợp lệ")
	}
	meta := dataURL[:commaIdx]
	payload := dataURL[commaIdx+1:]

	var data []byte
	if strings.Contains(meta, ";base64") {
		decoded, err := base64.StdEncoding.DecodeString(payload)
		if err != nil {
			return fmt.Errorf("không thể giải mã base64: %w", err)
		}
		data = decoded
	} else {
		unescaped, err := url.QueryUnescape(payload)
		if err != nil {
			unescaped = payload
		}
		data = []byte(unescaped)
	}

	return os.WriteFile(destPath, data, 0644)
}

func downloadStream(ctx context.Context, job *Job, targetURL string, headers map[string]string, partPath string, initialBytes int64) (int64, error) {
	if strings.HasPrefix(targetURL, "data:") {
		if err := writeDataURL(targetURL, partPath); err != nil {
			return 0, err
		}
		fi, err := os.Stat(partPath)
		if err != nil {
			return 0, err
		}
		return fi.Size(), nil
	}

	reporter := newJobProgressReporter(job, initialBytes)

	opts := multidownload.DownloadOptions{
		Headers:        headers,
		MaxConcurrency: multidownload.MaxConcurrency,
		Reporter:       reporter,
		PrepareRequest: func(req *http.Request) {
			prepareXRequest(req, headers)
		},
	}

	downloaded, err := multidownload.DownloadFile(ctx, targetURL, partPath, opts)
	reporter.Done()
	return downloaded, err
}

func downloadAllItems(ctx context.Context, job *Job, workspace string) error {
	job.mu.RLock()
	items := job.items
	headers := job.headers
	singleURL := job.URL
	singleFilename := job.Filename
	job.mu.RUnlock()

	if len(items) > 0 {
		var networkBatch []multidownload.BatchItem
		for _, item := range items {
			destFile := filepath.Join(workspace, item.Filename)
			if strings.HasPrefix(item.URL, "data:") {
				if err := writeDataURL(item.URL, destFile); err != nil {
					return err
				}
				continue
			}

			networkBatch = append(networkBatch, multidownload.BatchItem{
				URL:      item.URL,
				DestPath: destFile,
				Headers:  headers,
				PrepareRequest: func(req *http.Request) {
					prepareXRequest(req, headers)
				},
			})
		}

		if len(networkBatch) > 0 {
			reporter := newJobProgressReporter(job, 0)
			if err := multidownload.DownloadBatch(ctx, networkBatch, multidownload.MaxConcurrency, reporter); err != nil {
				return err
			}
		}
		return nil
	}

	// Single media file download
	destFile := filepath.Join(workspace, singleFilename)
	if strings.HasPrefix(singleURL, "data:") {
		return writeDataURL(singleURL, destFile)
	}

	partFile := destFile + ".part"
	_, err := downloadStream(ctx, job, singleURL, headers, partFile, 0)
	if err != nil {
		return err
	}
	_ = os.Remove(destFile)
	return os.Rename(partFile, destFile)
}
