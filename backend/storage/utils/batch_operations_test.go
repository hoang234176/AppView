package utils

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExecuteBatchSameDrive(t *testing.T) {
	tempRoot := t.TempDir()

	// Setup files & folders
	srcFolder := filepath.Join(tempRoot, "src_folder")
	_ = os.MkdirAll(srcFolder, 0755)
	file1 := filepath.Join(srcFolder, "test1.txt")
	_ = os.WriteFile(file1, []byte("hello world same drive"), 0644)

	destFolder := filepath.Join(tempRoot, "dest_folder")
	_ = os.MkdirAll(destFolder, 0755)

	items := []BatchItem{
		{Type: "file", Path: "src_folder/test1.txt"},
	}

	// 1. Test Copy
	var progressCalled bool
	err := ExecuteBatchSameDrive(tempRoot, items, "dest_folder", "copy", func(copied int64, file string) {
		progressCalled = true
	})
	if err != nil {
		t.Fatalf("ExecuteBatchSameDrive copy failed: %v", err)
	}
	if !progressCalled {
		t.Errorf("expected progress callback to be called")
	}

	destCopiedFile := filepath.Join(destFolder, "test1.txt")
	if _, err := os.Stat(destCopiedFile); os.IsNotExist(err) {
		t.Fatalf("copied file does not exist at %s", destCopiedFile)
	}

	// 2. Test Move
	err = ExecuteBatchSameDrive(tempRoot, items, "dest_folder_2", "move", nil)
	if err != nil {
		t.Fatalf("ExecuteBatchSameDrive move failed: %v", err)
	}
	destMovedFile := filepath.Join(tempRoot, "dest_folder_2", "test1.txt")
	if _, err := os.Stat(destMovedFile); os.IsNotExist(err) {
		t.Fatalf("moved file does not exist at %s", destMovedFile)
	}
	if _, err := os.Stat(file1); !os.IsNotExist(err) {
		t.Fatalf("original file still exists after move")
	}

	// 3. Test Delete
	deleteItems := []BatchItem{
		{Type: "file", Path: "dest_folder_2/test1.txt"},
	}
	err = ExecuteBatchSameDrive(tempRoot, deleteItems, "", "delete", nil)
	if err != nil {
		t.Fatalf("ExecuteBatchSameDrive delete failed: %v", err)
	}
	if _, err := os.Stat(destMovedFile); !os.IsNotExist(err) {
		t.Fatalf("file still exists after delete")
	}
}

func TestExecuteBatchCrossDrive(t *testing.T) {
	driveA := t.TempDir()
	driveB := t.TempDir()

	// Create file in Drive A
	fileA := filepath.Join(driveA, "video.mp4")
	_ = os.WriteFile(fileA, []byte("dummy video content across drives"), 0644)

	items := []BatchItem{
		{Type: "video", Path: "video.mp4"},
	}

	// 1. Test Cross-drive Copy
	var copiedBytesTotal int64
	err := ExecuteBatchCrossDrive(driveA, driveB, items, "backup", "copy", func(copied int64, file string) {
		copiedBytesTotal = copied
	})
	if err != nil {
		t.Fatalf("ExecuteBatchCrossDrive copy failed: %v", err)
	}
	if copiedBytesTotal == 0 {
		t.Errorf("expected copiedBytesTotal > 0")
	}

	destFileB := filepath.Join(driveB, "backup", "video.mp4")
	if _, err := os.Stat(destFileB); os.IsNotExist(err) {
		t.Fatalf("cross-drive copied file does not exist at %s", destFileB)
	}
	// Source file should still exist
	if _, err := os.Stat(fileA); os.IsNotExist(err) {
		t.Fatalf("source file should still exist after copy")
	}

	// 2. Test Cross-drive Move
	err = ExecuteBatchCrossDrive(driveA, driveB, items, "moved", "move", nil)
	if err != nil {
		t.Fatalf("ExecuteBatchCrossDrive move failed: %v", err)
	}
	destMovedB := filepath.Join(driveB, "moved", "video.mp4")
	if _, err := os.Stat(destMovedB); os.IsNotExist(err) {
		t.Fatalf("cross-drive moved file does not exist at %s", destMovedB)
	}
	// Source file must be deleted after move
	if _, err := os.Stat(fileA); !os.IsNotExist(err) {
		t.Fatalf("source file was not deleted after cross-drive move")
	}
}

func TestExecuteBatchCrossDrive_FolderWithThumbnails(t *testing.T) {
	driveA := t.TempDir()
	driveB := t.TempDir()

	// Create folder with file in Drive A
	folderA := filepath.Join(driveA, "photos")
	_ = os.MkdirAll(folderA, 0755)
	fileA := filepath.Join(folderA, "sample.jpg")
	_ = os.WriteFile(fileA, []byte("photo-content"), 0644)

	// Create thumbnail directory and thumbnail file for this folder in Drive A
	thumbDirA := filepath.Join(driveA, ".thumbnails", "photos")
	_ = os.MkdirAll(thumbDirA, 0755)
	thumbFileA := filepath.Join(thumbDirA, "sample.jpg")
	_ = os.WriteFile(thumbFileA, []byte("thumb-content"), 0644)

	items := []BatchItem{
		{Type: "folder", Path: "photos"},
	}

	// Move folder across drives (previously panicked with nil pointer dereference on copiedAccumulator)
	err := ExecuteBatchCrossDrive(driveA, driveB, items, "album", "move", nil)
	if err != nil {
		t.Fatalf("ExecuteBatchCrossDrive folder move failed: %v", err)
	}

	// Verify target folder exists in Drive B
	destFolderB := filepath.Join(driveB, "album", "photos")
	destFileB := filepath.Join(destFolderB, "sample.jpg")
	if _, err := os.Stat(destFileB); os.IsNotExist(err) {
		t.Fatalf("destination file %s does not exist", destFileB)
	}

	// Verify thumbnail was moved to Drive B
	destThumbB := filepath.Join(driveB, ".thumbnails", "album", "photos", "sample.jpg")
	if _, err := os.Stat(destThumbB); os.IsNotExist(err) {
		t.Fatalf("destination thumbnail %s does not exist", destThumbB)
	}

	// Verify source folder and source thumbnail were removed
	if _, err := os.Stat(folderA); !os.IsNotExist(err) {
		t.Fatalf("source folder still exists after move")
	}
	if _, err := os.Stat(thumbDirA); !os.IsNotExist(err) {
		t.Fatalf("source thumbnail dir still exists after move")
	}
}
