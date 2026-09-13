package instagram

import (
	"context"
	"fmt"
	"net/http"
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

func prepareInstagramRequest(req *http.Request, headers map[string]string) {
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
		req.Header.Set("Referer", "https://www.instagram.com/")
	}
	if req.Header.Get("Cookie") == "" {
		if raw, exists, err := cookies.Read("instagram"); err == nil && exists && strings.TrimSpace(raw) != "" {
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

func downloadStream(ctx context.Context, job *Job, targetURL string, headers map[string]string, partPath string, initialBytes int64) (int64, error) {
	reporter := newJobProgressReporter(job, initialBytes)

	opts := multidownload.DownloadOptions{
		Headers:        headers,
		MaxConcurrency: multidownload.MaxConcurrency,
		Reporter:       reporter,
		PrepareRequest: func(req *http.Request) {
			prepareInstagramRequest(req, headers)
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
		reporter := newJobProgressReporter(job, 0)
		batchItems := make([]multidownload.BatchItem, len(items))
		for i, item := range items {
			destFile := filepath.Join(workspace, item.Filename)
			batchItems[i] = multidownload.BatchItem{
				URL:      item.URL,
				DestPath: destFile,
				Headers:  headers,
				PrepareRequest: func(req *http.Request) {
					prepareInstagramRequest(req, headers)
				},
			}
		}

		return multidownload.DownloadBatch(ctx, batchItems, multidownload.MaxConcurrency, reporter)
	}

	// Single media file download
	destFile := filepath.Join(workspace, singleFilename)
	partFile := destFile + ".part"
	_, err := downloadStream(ctx, job, singleURL, headers, partFile, 0)
	if err != nil {
		return err
	}
	_ = os.Remove(destFile)
	return os.Rename(partFile, destFile)
}
