package youtube

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"backend/multidownload"
)

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
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
			}
		},
	}

	downloaded, err := multidownload.DownloadFile(ctx, targetURL, partPath, opts)
	reporter.Done()
	return downloaded, err
}

func downloadDualStream(ctx context.Context, job *Job, videoURL, videoPart, audioURL, audioPart string, headers map[string]string) error {
	reporter := newJobProgressReporter(job, 0)

	cfg := multidownload.DualStreamConfig{
		VideoURL:      videoURL,
		VideoPartPath: videoPart,
		VideoHeaders:  headers,
		AudioURL:      audioURL,
		AudioPartPath: audioPart,
		AudioHeaders:  headers,
		Reporter:      reporter,
		PrepareRequest: func(req *http.Request) {
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
			}
		},
	}

	return multidownload.DownloadDualStream(ctx, cfg)
}

func muxVideoAudio(ctx context.Context, videoPart, audioPart, outputPath string) error {
	_ = os.Remove(outputPath)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-i", videoPart, "-i", audioPart, "-c", "copy", "-movflags", "+faststart", outputPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("ghép video/audio thất bại: %s", strings.TrimSpace(string(output)))
	}
	return nil
}
