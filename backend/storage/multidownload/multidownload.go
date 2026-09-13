package multidownload

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	// MaxConcurrency is the strict upper bound on parallel connections.
	MaxConcurrency = 5

	// MinChunkSize is the minimum file size (5MB) required to split into range chunks.
	MinChunkSize = 5 * 1024 * 1024

	// DefaultBufferSize is the buffer size used for streaming data (128 KB).
	DefaultBufferSize = 128 * 1024
)

// ProgressReporter manages thread-safe aggregation of downloaded bytes and real-time speed calculation.
type ProgressReporter struct {
	mu             sync.Mutex
	initialBytes   int64
	downloaded     int64
	totalBytes     int64
	lastBytes      int64
	lastTime       time.Time
	updateInterval time.Duration
	onUpdate       func(downloaded int64, total int64, speed int64)
}

// NewProgressReporter creates a new ProgressReporter.
func NewProgressReporter(initialBytes int64, updateInterval time.Duration, onUpdate func(downloaded int64, total int64, speed int64)) *ProgressReporter {
	if updateInterval <= 0 {
		updateInterval = 500 * time.Millisecond
	}
	return &ProgressReporter{
		initialBytes:   initialBytes,
		downloaded:     initialBytes,
		lastBytes:      initialBytes,
		lastTime:       time.Now(),
		updateInterval: updateInterval,
		onUpdate:       onUpdate,
	}
}

// SetTotalBytes updates the known total bytes of the download.
func (pr *ProgressReporter) SetTotalBytes(total int64) {
	if pr == nil {
		return
	}
	pr.mu.Lock()
	current := atomic.LoadInt64(&pr.downloaded)
	if total > 0 && current > total {
		total = current
	}
	pr.totalBytes = total
	pr.mu.Unlock()
}

// AddTotalBytes safely increments total known bytes for multi-stream downloads.
func (pr *ProgressReporter) AddTotalBytes(delta int64) {
	if pr == nil || delta <= 0 {
		return
	}
	pr.mu.Lock()
	pr.totalBytes += delta
	current := atomic.LoadInt64(&pr.downloaded)
	if pr.totalBytes > 0 && current > pr.totalBytes {
		pr.totalBytes = current
	}
	pr.mu.Unlock()
}

// TotalBytes returns the currently known total bytes.
func (pr *ProgressReporter) TotalBytes() int64 {
	if pr == nil {
		return 0
	}
	pr.mu.Lock()
	defer pr.mu.Unlock()
	return pr.totalBytes
}

// Add atomically records n transferred bytes and triggers progress callback if interval elapsed.
func (pr *ProgressReporter) Add(n int64) {
	if pr == nil || n <= 0 {
		return
	}
	current := atomic.AddInt64(&pr.downloaded, n)

	pr.mu.Lock()
	if pr.totalBytes > 0 && current > pr.totalBytes {
		pr.totalBytes = current
	}
	now := time.Now()
	elapsed := now.Sub(pr.lastTime)
	if elapsed >= pr.updateInterval {
		speed := int64(float64(current-pr.lastBytes) / elapsed.Seconds())
		pr.lastBytes = current
		pr.lastTime = now
		total := pr.totalBytes
		cb := pr.onUpdate
		pr.mu.Unlock()

		if cb != nil {
			cb(current, total, speed)
		}
		return
	}
	pr.mu.Unlock()
}

// Downloaded returns the current total downloaded bytes.
func (pr *ProgressReporter) Downloaded() int64 {
	if pr == nil {
		return 0
	}
	return atomic.LoadInt64(&pr.downloaded)
}

// Done signals completion of download and sends a final update with speed = 0.
func (pr *ProgressReporter) Done() {
	if pr == nil {
		return
	}
	pr.mu.Lock()
	current := atomic.LoadInt64(&pr.downloaded)
	if pr.totalBytes > 0 && current > pr.totalBytes {
		pr.totalBytes = current
	}
	total := pr.totalBytes
	cb := pr.onUpdate
	pr.mu.Unlock()

	if cb != nil {
		cb(current, total, 0)
	}
}

// DownloadOptions configures a single file download.
type DownloadOptions struct {
	Headers         map[string]string
	MaxConcurrency  int
	Client          *http.Client
	Reporter        *ProgressReporter
	PrepareRequest  func(req *http.Request)
	FallbackRequest func(ctx context.Context, origReq *http.Request, resp *http.Response) (*http.Request, bool)
	IsMultiStream   bool
}

type byteRange struct {
	start int64
	end   int64
}

// DownloadFile downloads a file from targetURL to partPath using up to 5 concurrent range connections
// if supported by the server and file size >= MinChunkSize. Otherwise it falls back to a single stream.
// No speed throttling is applied.
func DownloadFile(ctx context.Context, targetURL string, partPath string, opts DownloadOptions) (int64, error) {
	concurrency := opts.MaxConcurrency
	if concurrency <= 0 || concurrency > MaxConcurrency {
		concurrency = MaxConcurrency
	}

	client := opts.Client
	if client == nil {
		client = &http.Client{Timeout: 0}
	}

	// Check if part file already exists with some bytes
	var existingBytes int64
	if info, statErr := os.Stat(partPath); statErr == nil {
		existingBytes = info.Size()
	}

	// If resuming from existing bytes on single stream
	if existingBytes > 0 {
		return resumeSingleStream(ctx, client, targetURL, partPath, existingBytes, opts)
	}

	// Probe server with Range: bytes=0-0 to check range support and determine Content-Length
	probeReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return 0, err
	}
	applyHeaders(probeReq, opts.Headers)
	if opts.PrepareRequest != nil {
		opts.PrepareRequest(probeReq)
	}
	probeReq.Header.Set("Range", "bytes=0-0")

	probeResp, err := client.Do(probeReq)
	if err != nil {
		return 0, err
	}

	// If probe returned non-2xx status, check fallback request (e.g. 403 UA fallback)
	if probeResp.StatusCode < 200 || probeResp.StatusCode >= 300 {
		if opts.FallbackRequest != nil {
			if altReq, ok := opts.FallbackRequest(ctx, probeReq, probeResp); ok && altReq != nil {
				probeResp.Body.Close()
				altResp, altErr := client.Do(altReq)
				if altErr == nil && altResp.StatusCode >= 200 && altResp.StatusCode < 300 {
					probeResp = altResp
				} else {
					if altResp != nil {
						altResp.Body.Close()
					}
					if altErr != nil {
						return 0, altErr
					}
					return 0, fmt.Errorf("máy chủ tải trả HTTP %d", altResp.StatusCode)
				}
			} else {
				probeResp.Body.Close()
				return 0, fmt.Errorf("máy chủ tải trả HTTP %d", probeResp.StatusCode)
			}
		} else {
			probeResp.Body.Close()
			return 0, fmt.Errorf("máy chủ tải trả HTTP %d", probeResp.StatusCode)
		}
	}

	// Case 1: Server returned 206 Partial Content
	if probeResp.StatusCode == http.StatusPartialContent {
		totalSize := parseContentRangeTotal(probeResp.Header.Get("Content-Range"))
		probeResp.Body.Close()

		if opts.Reporter != nil && totalSize > 0 {
			if opts.IsMultiStream {
				opts.Reporter.AddTotalBytes(totalSize)
			} else {
				opts.Reporter.SetTotalBytes(opts.Reporter.Downloaded() + totalSize)
			}
		}

		// If total size is valid and large enough, download concurrently in chunks
		if totalSize >= MinChunkSize && concurrency > 1 {
			return downloadMultiChunk(ctx, client, targetURL, partPath, totalSize, concurrency, opts)
		}

		// Otherwise, download as single stream
		return downloadFullSingleStream(ctx, client, targetURL, partPath, totalSize, opts)
	}

	// Case 2: Server returned 200 OK (server ignored Range header, single stream from byte 0)
	// We consume probeResp directly to avoid wasted request
	return streamResponseBodyToFile(ctx, probeResp, partPath, opts)
}

// downloadMultiChunk splits the file into chunks and downloads them in parallel using file.WriteAt.
func downloadMultiChunk(ctx context.Context, client *http.Client, targetURL, partPath string, totalSize int64, concurrency int, opts DownloadOptions) (int64, error) {
	file, err := os.OpenFile(partPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	if truncErr := file.Truncate(totalSize); truncErr != nil {
		// Non-fatal, continuing
	}

	chunkSize := totalSize / int64(concurrency)
	ranges := make([]byteRange, concurrency)
	for i := 0; i < concurrency; i++ {
		start := int64(i) * chunkSize
		end := start + chunkSize - 1
		if i == concurrency-1 {
			end = totalSize - 1
		}
		ranges[i] = byteRange{start: start, end: end}
	}

	innerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errCh := make(chan error, concurrency)

	for i, r := range ranges {
		wg.Add(1)
		go func(chunkIndex int, rng byteRange) {
			defer wg.Done()
			if chunkErr := downloadChunk(innerCtx, client, targetURL, file, rng, opts); chunkErr != nil {
				cancel() // cancel other chunks
				select {
				case errCh <- chunkErr:
				default:
				}
			}
		}(i, r)
	}

	wg.Wait()
	close(errCh)

	if firstErr := <-errCh; firstErr != nil {
		return 0, firstErr
	}

	_ = file.Sync()
	return totalSize, nil
}

// downloadChunk downloads a specific byte range and writes it to file via WriteAt.
func downloadChunk(ctx context.Context, client *http.Client, targetURL string, file *os.File, rng byteRange, opts DownloadOptions) error {
	const maxRetries = 2
	var currentOffset = rng.start

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if err != nil {
			return err
		}
		applyHeaders(req, opts.Headers)
		if opts.PrepareRequest != nil {
			opts.PrepareRequest(req)
		}
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", currentOffset, rng.end))

		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxRetries && ctx.Err() == nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}
			return err
		}

		if resp.StatusCode != http.StatusPartialContent && resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("máy chủ tải chunk trả HTTP %d", resp.StatusCode)
		}

		buf := make([]byte, DefaultBufferSize)
		readErr := func() error {
			defer resp.Body.Close()
			for {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				n, rErr := resp.Body.Read(buf)
				if n > 0 {
					if _, wErr := file.WriteAt(buf[:n], currentOffset); wErr != nil {
						return wErr
					}
					currentOffset += int64(n)
					if opts.Reporter != nil {
						opts.Reporter.Add(int64(n))
					}
				}
				if rErr == io.EOF {
					return nil
				}
				if rErr != nil {
					return rErr
				}
			}
		}()

		if readErr == nil {
			return nil
		}

		if attempt < maxRetries && ctx.Err() == nil {
			time.Sleep(150 * time.Millisecond)
			continue
		}
		return readErr
	}

	return errors.New("tải chunk thất bại sau số lần thử lại")
}

// downloadFullSingleStream downloads the entire file via a single GET request from byte 0.
func downloadFullSingleStream(ctx context.Context, client *http.Client, targetURL, partPath string, knownTotal int64, opts DownloadOptions) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return 0, err
	}
	applyHeaders(req, opts.Headers)
	if opts.PrepareRequest != nil {
		opts.PrepareRequest(req)
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("máy chủ tải trả HTTP %d", resp.StatusCode)
	}

	return streamResponseBodyToFile(ctx, resp, partPath, opts)
}

// resumeSingleStream resumes download using Range: bytes=existingBytes-.
func resumeSingleStream(ctx context.Context, client *http.Client, targetURL, partPath string, existingBytes int64, opts DownloadOptions) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return 0, err
	}
	applyHeaders(req, opts.Headers)
	if opts.PrepareRequest != nil {
		opts.PrepareRequest(req)
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-", existingBytes))

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

	if opts.Reporter != nil && resp.ContentLength > 0 {
		if opts.IsMultiStream {
			opts.Reporter.AddTotalBytes(resp.ContentLength)
		} else {
			opts.Reporter.SetTotalBytes(existingBytes + resp.ContentLength)
		}
	}

	buf := make([]byte, DefaultBufferSize)
	var downloaded = existingBytes
	for {
		if ctx.Err() != nil {
			return downloaded, ctx.Err()
		}
		n, rErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := file.Write(buf[:n]); wErr != nil {
				return downloaded, wErr
			}
			downloaded += int64(n)
			if opts.Reporter != nil {
				opts.Reporter.Add(int64(n))
			}
		}
		if rErr == io.EOF {
			break
		}
		if rErr != nil {
			return downloaded, rErr
		}
	}

	return downloaded, nil
}

// streamResponseBodyToFile writes an open http.Response.Body to partPath without re-requesting.
func streamResponseBodyToFile(ctx context.Context, resp *http.Response, partPath string, opts DownloadOptions) (int64, error) {
	defer resp.Body.Close()

	file, err := os.OpenFile(partPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	if opts.Reporter != nil && resp.ContentLength > 0 {
		if opts.IsMultiStream {
			opts.Reporter.AddTotalBytes(resp.ContentLength)
		} else {
			opts.Reporter.SetTotalBytes(opts.Reporter.Downloaded() + resp.ContentLength)
		}
	}

	buf := make([]byte, DefaultBufferSize)
	var downloaded int64
	for {
		if ctx.Err() != nil {
			return downloaded, ctx.Err()
		}
		n, rErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := file.Write(buf[:n]); wErr != nil {
				return downloaded, wErr
			}
			downloaded += int64(n)
			if opts.Reporter != nil {
				opts.Reporter.Add(int64(n))
			}
		}
		if rErr == io.EOF {
			break
		}
		if rErr != nil {
			return downloaded, rErr
		}
	}

	return downloaded, nil
}

func applyHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		lk := strings.ToLower(k)
		if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" || lk == "cookie" {
			req.Header.Set(k, v)
		}
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0 AppView/1.0")
	}
}

// parseContentRangeTotal extracts total bytes from "bytes 0-0/123456"
func parseContentRangeTotal(contentRange string) int64 {
	if contentRange == "" {
		return 0
	}
	parts := strings.Split(contentRange, "/")
	if len(parts) == 2 {
		totalStr := strings.TrimSpace(parts[1])
		if total, err := strconv.ParseInt(totalStr, 10, 64); err == nil {
			return total
		}
	}
	return 0
}
