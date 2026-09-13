package multidownload

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDownloadFile_MultiChunk206(t *testing.T) {
	// Create test payload > 5MB to trigger chunking (e.g. 6MB)
	payloadSize := 6 * 1024 * 1024
	testPayload := make([]byte, payloadSize)
	for i := range testPayload {
		testPayload[i] = byte(i % 256)
	}

	var rangeRequestsCount int64

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rangeHeader := r.Header.Get("Range")
		if rangeHeader == "" {
			w.Header().Set("Content-Length", strconv.Itoa(payloadSize))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(testPayload)
			return
		}

		atomic.AddInt64(&rangeRequestsCount, 1)

		// Parse Range: bytes=start-end
		if strings.HasPrefix(rangeHeader, "bytes=") {
			byteSpec := strings.TrimPrefix(rangeHeader, "bytes=")
			parts := strings.Split(byteSpec, "-")
			start, _ := strconv.ParseInt(parts[0], 10, 64)
			var end int64 = int64(payloadSize - 1)
			if parts[1] != "" {
				end, _ = strconv.ParseInt(parts[1], 10, 64)
			}
			if end >= int64(payloadSize) {
				end = int64(payloadSize - 1)
			}

			w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, payloadSize))
			w.Header().Set("Content-Length", strconv.FormatInt(end-start+1, 10))
			w.WriteHeader(http.StatusPartialContent)
			_, _ = w.Write(testPayload[start : end+1])
			return
		}

		http.Error(w, "Bad range", http.StatusRequestedRangeNotSatisfiable)
	}))
	defer ts.Close()

	tempDir := t.TempDir()
	partPath := filepath.Join(tempDir, "test.part")

	var progressUpdates int64
	reporter := NewProgressReporter(0, 50*time.Millisecond, func(downloaded, total, speed int64) {
		atomic.AddInt64(&progressUpdates, 1)
	})

	downloaded, err := DownloadFile(context.Background(), ts.URL, partPath, DownloadOptions{
		MaxConcurrency: 5,
		Reporter:       reporter,
	})
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	if downloaded != int64(payloadSize) {
		t.Errorf("Downloaded = %d; want %d", downloaded, payloadSize)
	}

	// Verify file content matches original payload byte for byte
	data, err := os.ReadFile(partPath)
	if err != nil {
		t.Fatalf("read file failed: %v", err)
	}
	if !bytes.Equal(data, testPayload) {
		t.Fatalf("downloaded file content does not match expected payload")
	}

	// Verify probe + chunks occurred (1 probe + 5 chunks = 6 requests with Range)
	if atomic.LoadInt64(&rangeRequestsCount) < 5 {
		t.Errorf("expected at least 5 range requests, got %d", rangeRequestsCount)
	}
}

func TestDownloadFile_Fallback200(t *testing.T) {
	// Server ignores Range and returns 200 OK directly
	payload := []byte("hello-world-data-without-range")
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(payload)
	}))
	defer ts.Close()

	tempDir := t.TempDir()
	partPath := filepath.Join(tempDir, "fallback.part")

	downloaded, err := DownloadFile(context.Background(), ts.URL, partPath, DownloadOptions{
		MaxConcurrency: 5,
	})
	if err != nil {
		t.Fatalf("DownloadFile fallback failed: %v", err)
	}
	if downloaded != int64(len(payload)) {
		t.Errorf("Downloaded = %d; want %d", downloaded, len(payload))
	}

	data, err := os.ReadFile(partPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, payload) {
		t.Fatalf("content mismatch")
	}
}

func TestDownloadBatch_ConcurrentItems(t *testing.T) {
	// 8 small images to download concurrently
	const itemCount = 8
	itemsData := make([][]byte, itemCount)
	for i := 0; i < itemCount; i++ {
		itemsData[i] = []byte(fmt.Sprintf("image-content-%d", i))
	}

	var activeConnections int64
	var maxObservedConnections int64

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		curr := atomic.AddInt64(&activeConnections, 1)
		for {
			max := atomic.LoadInt64(&maxObservedConnections)
			if curr <= max || atomic.CompareAndSwapInt64(&maxObservedConnections, max, curr) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond) // artificial slight delay to test concurrency
		defer atomic.AddInt64(&activeConnections, -1)

		idxStr := strings.TrimPrefix(r.URL.Path, "/img/")
		idx, _ := strconv.Atoi(idxStr)
		if idx >= 0 && idx < itemCount {
			w.Header().Set("Content-Length", strconv.Itoa(len(itemsData[idx])))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(itemsData[idx])
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	tempDir := t.TempDir()
	batchItems := make([]BatchItem, itemCount)
	for i := 0; i < itemCount; i++ {
		batchItems[i] = BatchItem{
			URL:      fmt.Sprintf("%s/img/%d", ts.URL, i),
			DestPath: filepath.Join(tempDir, fmt.Sprintf("img_%d.jpg", i)),
		}
	}

	reporter := NewProgressReporter(0, 50*time.Millisecond, nil)
	err := DownloadBatch(context.Background(), batchItems, 5, reporter)
	if err != nil {
		t.Fatalf("DownloadBatch failed: %v", err)
	}

	if maxObservedConnections > 5 {
		t.Errorf("max active connections %d exceeded concurrency limit 5", maxObservedConnections)
	}

	// Verify all items downloaded and renamed properly
	for i := 0; i < itemCount; i++ {
		dest := batchItems[i].DestPath
		data, err := os.ReadFile(dest)
		if err != nil {
			t.Fatalf("read dest %d failed: %v", i, err)
		}
		if !bytes.Equal(data, itemsData[i]) {
			t.Errorf("item %d content mismatch", i)
		}
	}
}

func TestDownloadDualStream_YouTube(t *testing.T) {
	videoContent := []byte("video-stream-payload")
	audioContent := []byte("audio-stream-payload")

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/video" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(videoContent)
			return
		}
		if r.URL.Path == "/audio" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(audioContent)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	tempDir := t.TempDir()
	vPart := filepath.Join(tempDir, "video.part")
	aPart := filepath.Join(tempDir, "audio.part")

	var maxDownloaded int64
	var minTotal int64 = 1<<62 - 1
	reporter := NewProgressReporter(0, 10*time.Millisecond, func(dl, tot, spd int64) {
		if dl > maxDownloaded {
			maxDownloaded = dl
		}
		if tot > 0 && tot < minTotal {
			minTotal = tot
		}
	})

	err := DownloadDualStream(context.Background(), DualStreamConfig{
		VideoURL:      ts.URL + "/video",
		VideoPartPath: vPart,
		AudioURL:      ts.URL + "/audio",
		AudioPartPath: aPart,
		Reporter:      reporter,
	})
	if err != nil {
		t.Fatalf("DownloadDualStream failed: %v", err)
	}

	expectedTotal := int64(len(videoContent) + len(audioContent))
	if reporter.TotalBytes() != expectedTotal {
		t.Errorf("reporter.TotalBytes() = %d; want %d", reporter.TotalBytes(), expectedTotal)
	}
	if reporter.Downloaded() != expectedTotal {
		t.Errorf("reporter.Downloaded() = %d; want %d", reporter.Downloaded(), expectedTotal)
	}
	if reporter.Downloaded() > reporter.TotalBytes() {
		t.Errorf("downloaded %d exceeded total %d", reporter.Downloaded(), reporter.TotalBytes())
	}

	vData, _ := os.ReadFile(vPart)
	aData, _ := os.ReadFile(aPart)
	if !bytes.Equal(vData, videoContent) {
		t.Errorf("video content mismatch")
	}
	if !bytes.Equal(aData, audioContent) {
		t.Errorf("audio content mismatch")
	}
}

func TestDownloadVideoParts_MultiSegment(t *testing.T) {
	const partCount = 4
	partsData := make([][]byte, partCount)
	for i := 0; i < partCount; i++ {
		partsData[i] = []byte(fmt.Sprintf("segment-part-%d", i))
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idxStr := strings.TrimPrefix(r.URL.Path, "/part/")
		idx, _ := strconv.Atoi(idxStr)
		if idx >= 0 && idx < partCount {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(partsData[idx])
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	tempDir := t.TempDir()
	parts := make([]VideoPart, partCount)
	for i := 0; i < partCount; i++ {
		parts[i] = VideoPart{
			Index:    i,
			URL:      fmt.Sprintf("%s/part/%d", ts.URL, i),
			DestPath: filepath.Join(tempDir, fmt.Sprintf("part_%d.mp4", i)),
		}
	}

	err := DownloadVideoParts(context.Background(), parts, 5, nil)
	if err != nil {
		t.Fatalf("DownloadVideoParts failed: %v", err)
	}

	for i := 0; i < partCount; i++ {
		data, err := os.ReadFile(parts[i].DestPath)
		if err != nil {
			t.Fatalf("failed reading part %d: %v", i, err)
		}
		if !bytes.Equal(data, partsData[i]) {
			t.Errorf("part %d content mismatch", i)
		}
	}
}

func TestDownloadFile_ContextCancellation(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "10000000")
		w.WriteHeader(http.StatusOK)
		// Write some bytes then block until client cancels
		w.Write([]byte("start"))
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		<-r.Context().Done()
	}))
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	tempDir := t.TempDir()
	partPath := filepath.Join(tempDir, "cancel.part")

	_, err := DownloadFile(ctx, ts.URL, partPath, DownloadOptions{})
	if err == nil {
		t.Fatal("expected error on context cancellation, got nil")
	}
}
