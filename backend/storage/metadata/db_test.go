package metadata

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMetadataDB(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "appview_meta_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "metadata.db")
	t.Setenv("METADATA_DB_PATH", dbPath)

	if err := InitDB(); err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}

	// 1. Test Upsert and Get
	meta := &MediaMeta{
		Drive:     "HDD",
		Path:      "Cosplay/test_image.jpg",
		Folder:    "Cosplay",
		MediaType: "picture",
		Width:     1920,
		Height:    1080,
		Size:      1024000,
		ModTime:   time.Now().Unix(),
		HasThumb:  true,
	}

	if err := UpsertMetadata(meta); err != nil {
		t.Fatalf("UpsertMetadata failed: %v", err)
	}

	got, err := GetItemMetadata("HDD", "Cosplay/test_image.jpg")
	if err != nil {
		t.Fatalf("GetItemMetadata failed: %v", err)
	}
	if got == nil || got.Width != 1920 || got.Height != 1080 || !got.HasThumb {
		t.Fatalf("Unexpected item metadata: %+v", got)
	}

	// 2. Test GetFolderMetadata
	folderMap, err := GetFolderMetadata("HDD", "Cosplay")
	if err != nil {
		t.Fatalf("GetFolderMetadata failed: %v", err)
	}
	if len(folderMap) != 1 || folderMap["Cosplay/test_image.jpg"] == nil {
		t.Fatalf("Unexpected folder map: %+v", folderMap)
	}

	// 3. Test UpdateThumbStatus
	if err := UpdateThumbStatus("HDD", "Cosplay/test_image.jpg", true, 2000, 1500); err != nil {
		t.Fatalf("UpdateThumbStatus failed: %v", err)
	}
	gotUpdated, _ := GetItemMetadata("HDD", "Cosplay/test_image.jpg")
	if gotUpdated.Width != 2000 || gotUpdated.Height != 1500 {
		t.Fatalf("UpdateThumbStatus didn't update dimensions: %+v", gotUpdated)
	}

	// 4. Test RenameFolderMetadata
	if err := RenameFolderMetadata("HDD", "Cosplay", "Cosplay_New"); err != nil {
		t.Fatalf("RenameFolderMetadata failed: %v", err)
	}
	renamedMap, _ := GetFolderMetadata("HDD", "Cosplay_New")
	if len(renamedMap) != 1 || renamedMap["Cosplay_New/test_image.jpg"] == nil {
		t.Fatalf("RenameFolderMetadata failed to update paths: %+v", renamedMap)
	}

	// 5. Test DeleteFolderMetadata
	if err := DeleteFolderMetadata("HDD", "Cosplay_New"); err != nil {
		t.Fatalf("DeleteFolderMetadata failed: %v", err)
	}
	emptyMap, _ := GetFolderMetadata("HDD", "Cosplay_New")
	if len(emptyMap) != 0 {
		t.Fatalf("Expected empty folder map after delete, got %d", len(emptyMap))
	}
}

func TestGetDBPath(t *testing.T) {
	t.Setenv("METADATA_DB_PATH", "")
	path := GetDBPath()
	expectedSub := filepath.Join(".tmp-appview", "metadata", "metadata.db")
	if !filepath.IsAbs(path) || filepath.Base(path) != "metadata.db" || filepath.Base(filepath.Dir(path)) != "metadata" {
		t.Fatalf("expected db path in .tmp-appview/metadata/metadata.db, got %q (expected suffix %q)", path, expectedSub)
	}
}
