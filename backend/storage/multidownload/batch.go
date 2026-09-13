package multidownload

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

// BatchItem represents a single file to be downloaded in a batch.
type BatchItem struct {
	URL            string
	DestPath       string
	PartPath       string // if empty, defaults to DestPath + ".part"
	Headers        map[string]string
	PrepareRequest func(req *http.Request)
	MaxConcurrency int // per-item concurrency if single item is partitioned (defaults to 1)
}

// DownloadBatch downloads multiple items concurrently with a maximum of maxConcurrency concurrent workers (bounded to 5).
// When an item finishes successfully, its PartPath is renamed to DestPath.
// If any item fails, ctx is cancelled and the first error is returned.
func DownloadBatch(ctx context.Context, items []BatchItem, maxConcurrency int, reporter *ProgressReporter) error {
	if len(items) == 0 {
		return nil
	}
	if maxConcurrency <= 0 || maxConcurrency > MaxConcurrency {
		maxConcurrency = MaxConcurrency
	}

	innerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	workCh := make(chan BatchItem, len(items))
	for _, it := range items {
		if it.PartPath == "" {
			it.PartPath = it.DestPath + ".part"
		}
		workCh <- it
	}
	close(workCh)

	workerCount := maxConcurrency
	if len(items) < workerCount {
		workerCount = len(items)
	}

	var wg sync.WaitGroup
	errCh := make(chan error, workerCount)

	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range workCh {
				if innerCtx.Err() != nil {
					return
				}

				// Ensure directory exists
				if dir := filepath.Dir(item.DestPath); dir != "" {
					_ = os.MkdirAll(dir, 0755)
				}

				itemOpts := DownloadOptions{
					Headers:        item.Headers,
					MaxConcurrency: 1, // each worker handles 1 stream, preserving total pool limit
					Reporter:       reporter,
					PrepareRequest: item.PrepareRequest,
					IsMultiStream:  true,
				}
				if item.MaxConcurrency > 1 {
					itemOpts.MaxConcurrency = item.MaxConcurrency
				}

				_, err := DownloadFile(innerCtx, item.URL, item.PartPath, itemOpts)
				if err != nil {
					cancel()
					select {
					case errCh <- fmt.Errorf("tải thất bại %s: %w", filepath.Base(item.DestPath), err):
					default:
					}
					return
				}

				// Rename .part to DestPath upon success
				if item.DestPath != item.PartPath {
					_ = os.Remove(item.DestPath)
					if renErr := os.Rename(item.PartPath, item.DestPath); renErr != nil {
						cancel()
						select {
						case errCh <- fmt.Errorf("đổi tên file tạm thất bại: %w", renErr):
						default:
						}
						return
					}
				}
			}
		}()
	}

	wg.Wait()
	close(errCh)

	if reporter != nil {
		reporter.Done()
	}

	if firstErr := <-errCh; firstErr != nil {
		return firstErr
	}
	return nil
}

// VideoPart represents a segment or part of a multi-part video (future extensible format).
type VideoPart struct {
	Index          int
	URL            string
	DestPath       string
	Headers        map[string]string
	PrepareRequest func(req *http.Request)
}

// DownloadVideoParts downloads N video parts concurrently with a pool limit of maxConcurrency (capped at 5).
func DownloadVideoParts(ctx context.Context, parts []VideoPart, maxConcurrency int, reporter *ProgressReporter) error {
	if len(parts) == 0 {
		return errors.New("danh sách part video trống")
	}

	batchItems := make([]BatchItem, len(parts))
	for i, p := range parts {
		batchItems[i] = BatchItem{
			URL:            p.URL,
			DestPath:       p.DestPath,
			Headers:        p.Headers,
			PrepareRequest: p.PrepareRequest,
		}
	}
	return DownloadBatch(ctx, batchItems, maxConcurrency, reporter)
}

// DualStreamConfig configures concurrent download of 1 video stream + 1 audio stream (e.g. YouTube adaptive).
// Total concurrency is strictly bounded to 5: video gets up to 4 threads, audio gets 1 thread.
type DualStreamConfig struct {
	VideoURL       string
	VideoPartPath  string
	VideoHeaders   map[string]string
	AudioURL       string
	AudioPartPath  string
	AudioHeaders   map[string]string
	PrepareRequest func(req *http.Request)
	Reporter       *ProgressReporter
	Client         *http.Client
}

// DownloadDualStream downloads video stream and audio stream concurrently.
// Video stream uses up to 4 range chunks (if supported), audio stream uses 1 connection.
// Total connections <= 5.
func DownloadDualStream(ctx context.Context, cfg DualStreamConfig) error {
	innerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errCh := make(chan error, 2)

	// Launch Video stream (up to 4 threads)
	wg.Add(1)
	go func() {
		defer wg.Done()
		videoOpts := DownloadOptions{
			Headers:        cfg.VideoHeaders,
			MaxConcurrency: 4, // 4 threads for video
			Client:         cfg.Client,
			Reporter:       cfg.Reporter,
			PrepareRequest: cfg.PrepareRequest,
			IsMultiStream:  true,
		}
		_, err := DownloadFile(innerCtx, cfg.VideoURL, cfg.VideoPartPath, videoOpts)
		if err != nil {
			cancel()
			select {
			case errCh <- fmt.Errorf("tải video part thất bại: %w", err):
			default:
			}
		}
	}()

	// Launch Audio stream (1 thread)
	wg.Add(1)
	go func() {
		defer wg.Done()
		audioOpts := DownloadOptions{
			Headers:        cfg.AudioHeaders,
			MaxConcurrency: 1, // 1 thread for audio
			Client:         cfg.Client,
			Reporter:       cfg.Reporter,
			PrepareRequest: cfg.PrepareRequest,
			IsMultiStream:  true,
		}
		_, err := DownloadFile(innerCtx, cfg.AudioURL, cfg.AudioPartPath, audioOpts)
		if err != nil {
			cancel()
			select {
			case errCh <- fmt.Errorf("tải audio part thất bại: %w", err):
			default:
			}
		}
	}()

	wg.Wait()
	close(errCh)

	if cfg.Reporter != nil {
		cfg.Reporter.Done()
	}

	if firstErr := <-errCh; firstErr != nil {
		return firstErr
	}
	return nil
}
