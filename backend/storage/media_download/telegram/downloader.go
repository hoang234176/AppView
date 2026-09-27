package telegram

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/multidownload"
)

func prepareTelegramRequest(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		lk := strings.ToLower(k)
		if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" || lk == "cookie" {
			req.Header.Set(k, v)
		}
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
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
		MaxConcurrency: 4,
		Reporter:       reporter,
		PrepareRequest: func(req *http.Request) {
			prepareTelegramRequest(req, headers)
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

	if len(items) > 1 {
		reporter := newJobProgressReporter(job, 0)
		batchItems := make([]multidownload.BatchItem, len(items))
		for i, item := range items {
			destFile := filepath.Join(workspace, item.Filename)
			batchItems[i] = multidownload.BatchItem{
				URL:      item.URL,
				DestPath: destFile,
				Headers:  headers,
				PrepareRequest: func(req *http.Request) {
					prepareTelegramRequest(req, headers)
				},
			}
		}

		return multidownload.DownloadBatch(ctx, batchItems, 4, reporter)
	}

	// Single media file download (or single item in album)
	destFilename := singleFilename
	targetURL := singleURL
	if len(items) == 1 {
		destFilename = items[0].Filename
		targetURL = items[0].URL
	}

	destFile := filepath.Join(workspace, destFilename)
	partFile := destFile + ".part"
	_, err := downloadStream(ctx, job, targetURL, headers, partFile, 0)
	if err != nil {
		return err
	}
	_ = os.Remove(destFile)
	return os.Rename(partFile, destFile)
}
