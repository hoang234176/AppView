package utils

import (
	"os"
	"path/filepath"
	"testing"

	"backend/metadata"
	"backend/models"
)

func TestScanFolderMediaInfo_ShallowDepth1(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test_folder_media_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Level 2 (immediate) files: 2 pictures, 1 video, 1 text file
	_ = os.WriteFile(filepath.Join(tempDir, "photo1.jpg"), []byte("fake-photo-1"), 0644)
	_ = os.WriteFile(filepath.Join(tempDir, "photo2.png"), []byte("fake-photo-2"), 0644)
	_ = os.WriteFile(filepath.Join(tempDir, "clip1.mp4"), []byte("fake-video-1"), 0644)
	_ = os.WriteFile(filepath.Join(tempDir, "notes.txt"), []byte("text-content"), 0644)

	// Level 3 (nested subfolder) containing more media files
	subDir := filepath.Join(tempDir, "level3_sub")
	_ = os.MkdirAll(subDir, 0755)
	_ = os.WriteFile(filepath.Join(subDir, "nested_photo1.jpg"), []byte("nested"), 0644)
	_ = os.WriteFile(filepath.Join(subDir, "nested_photo2.jpg"), []byte("nested"), 0644)
	_ = os.WriteFile(filepath.Join(subDir, "nested_video.mp4"), []byte("nested"), 0644)

	previews, picCount, vidCount := ScanFolderMediaInfo(tempDir, "test_folder", 2)

	if picCount != 2 {
		t.Errorf("Expected pictureCount=2 (shallow depth=1), got %d", picCount)
	}
	if vidCount != 1 {
		t.Errorf("Expected videoCount=1 (shallow depth=1), got %d", vidCount)
	}
	if len(previews) != 2 {
		t.Errorf("Expected 2 previews, got %d", len(previews))
	}
}

func TestPopulateFolderPreviews_CachesCountsInSQLite(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test_folder_cache_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Setup db path inside tempDir
	t.Setenv("METADATA_DB_PATH", filepath.Join(tempDir, "test_metadata.db"))

	folderA := filepath.Join(tempDir, "FolderA")
	_ = os.MkdirAll(folderA, 0755)
	_ = os.WriteFile(filepath.Join(folderA, "img1.jpg"), []byte("img"), 0644)
	_ = os.WriteFile(filepath.Join(folderA, "img2.jpg"), []byte("img"), 0644)
	_ = os.WriteFile(filepath.Join(folderA, "vid1.mkv"), []byte("vid"), 0644)

	folders := []*models.FolderItem{
		{Name: "FolderA", Path: "FolderA", Type: "folder"},
	}

	PopulateFolderPreviews("TEST_DRIVE", tempDir, folders, "http://localhost:8080")

	if folders[0].PictureCount != 2 {
		t.Errorf("Expected FolderA PictureCount=2, got %d", folders[0].PictureCount)
	}
	if folders[0].VideoCount != 1 {
		t.Errorf("Expected FolderA VideoCount=1, got %d", folders[0].VideoCount)
	}
	if len(folders[0].Previews) != 2 {
		t.Errorf("Expected FolderA Previews length=2, got %d", len(folders[0].Previews))
	}

	// Delete one picture and invalidate parent folder cache
	_ = os.Remove(filepath.Join(folderA, "img1.jpg"))
	_ = metadata.InvalidateFolderMeta("TEST_DRIVE", "FolderA")

	folders2 := []*models.FolderItem{
		{Name: "FolderA", Path: "FolderA", Type: "folder"},
	}
	PopulateFolderPreviews("TEST_DRIVE", tempDir, folders2, "http://localhost:8080")

	if folders2[0].PictureCount != 1 {
		t.Errorf("Expected updated PictureCount=1 after delete, got %d", folders2[0].PictureCount)
	}
	if folders2[0].VideoCount != 1 {
		t.Errorf("Expected VideoCount=1, got %d", folders2[0].VideoCount)
	}
}
