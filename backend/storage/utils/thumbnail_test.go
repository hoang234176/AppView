package utils

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func createTestImage(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for x := 0; x < 100; x++ {
		for y := 0; y < 100; y++ {
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
}

func TestEnsureThumbnailRecoveryFromCrash(t *testing.T) {
	tempDir := t.TempDir()
	srcImgPath := filepath.Join(tempDir, "photo.png")
	thumbPath := filepath.Join(tempDir, ".thumbnails", "photo.png.jpg")

	createTestImage(t, srcImgPath)

	// Simulate crash: pre-create a 0-byte corrupted thumbnail file
	if err := os.MkdirAll(filepath.Dir(thumbPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(thumbPath, []byte{}, 0644); err != nil {
		t.Fatal(err)
	}

	// Verify 0-byte file exists
	fi, err := os.Stat(thumbPath)
	if err != nil || fi.Size() != 0 {
		t.Fatalf("expected 0-byte file before recovery, got size %d, err %v", fi.Size(), err)
	}

	// Call EnsureThumbnail
	if err := EnsureThumbnail(srcImgPath, thumbPath); err != nil {
		t.Fatalf("EnsureThumbnail failed: %v", err)
	}

	// Verify thumbnail was regenerated and has size > 0
	fiAfter, err := os.Stat(thumbPath)
	if err != nil {
		t.Fatalf("stat failed after EnsureThumbnail: %v", err)
	}
	if fiAfter.Size() <= 0 {
		t.Fatalf("expected non-empty thumbnail after recovery, got size %d", fiAfter.Size())
	}
}

func TestEnsureThumbnailConcurrentInFlight(t *testing.T) {
	tempDir := t.TempDir()
	srcImgPath := filepath.Join(tempDir, "photo2.png")
	thumbPath := filepath.Join(tempDir, ".thumbnails", "photo2.png.jpg")

	createTestImage(t, srcImgPath)

	var wg sync.WaitGroup
	errs := make(chan error, 10)

	// Launch 10 concurrent requests for the same thumbnail
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := EnsureThumbnail(srcImgPath, thumbPath); err != nil {
				errs <- err
			}
		}()
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("concurrent EnsureThumbnail failed: %v", err)
	}

	fi, err := os.Stat(thumbPath)
	if err != nil || fi.Size() == 0 {
		t.Fatalf("expected valid non-empty thumbnail, got fi=%v, err=%v", fi, err)
	}
}

func TestEnsureVideoThumbnail(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed, skipping video thumbnail test")
	}
	tempDir := t.TempDir()
	srcVidPath := filepath.Join(tempDir, "clip.mp4")
	thumbPath := filepath.Join(tempDir, ".thumbnails", "clip.mp4.jpg")

	cmd := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=1", "-vcodec", "libx264", srcVidPath)
	if err := cmd.Run(); err != nil {
		t.Fatalf("failed to create test video: %v", err)
	}

	if err := EnsureThumbnail(srcVidPath, thumbPath); err != nil {
		t.Fatalf("EnsureThumbnail for video failed: %v", err)
	}

	fi, err := os.Stat(thumbPath)
	if err != nil || fi.Size() == 0 {
		t.Fatalf("expected non-empty video thumbnail, got fi=%v, err=%v", fi, err)
	}
}

func TestEnsureMultipleVideoThumbnailsConcurrent(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed, skipping video thumbnail test")
	}
	tempDir := t.TempDir()

	srcVidPath1 := filepath.Join(tempDir, "clip1.mp4")
	thumbPath1 := filepath.Join(tempDir, ".thumbnails", "clip1.mp4.jpg")
	srcVidPath2 := filepath.Join(tempDir, "clip2.mp4")
	thumbPath2 := filepath.Join(tempDir, ".thumbnails", "clip2.mp4.jpg")

	cmd1 := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=red:s=320x240:d=1", "-vcodec", "libx264", srcVidPath1)
	if err := cmd1.Run(); err != nil {
		t.Fatalf("failed to create test video 1: %v", err)
	}
	cmd2 := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=green:s=320x240:d=1", "-vcodec", "libx264", srcVidPath2)
	if err := cmd2.Run(); err != nil {
		t.Fatalf("failed to create test video 2: %v", err)
	}

	var wg sync.WaitGroup
	errs := make(chan error, 2)

	wg.Add(2)
	go func() {
		defer wg.Done()
		if err := EnsureThumbnail(srcVidPath1, thumbPath1); err != nil {
			errs <- err
		}
	}()
	go func() {
		defer wg.Done()
		if err := EnsureThumbnail(srcVidPath2, thumbPath2); err != nil {
			errs <- err
		}
	}()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		close(errs)
		for err := range errs {
			t.Errorf("concurrent video thumbnail failed: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("DEADLOCK DETECTED: concurrent EnsureThumbnail for multiple videos timed out")
	}
}
