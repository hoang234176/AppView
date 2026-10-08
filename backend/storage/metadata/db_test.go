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

func TestFolderMeta(t *testing.T) {
	tempDir := t.TempDir()
	dbFile := filepath.Join(tempDir, "metadata.db")
	t.Setenv("METADATA_DB_PATH", dbFile)

	// 1. Insert folder meta
	fm1 := &FolderMeta{
		Drive:     "HDD",
		Folder:    "Albums/Cosplay",
		HasImages: true,
		Previews:  []string{"Albums/Cosplay/001.jpg", "Albums/Cosplay/002.jpg"},
		UpdatedAt: time.Now(),
	}
	fm2 := &FolderMeta{
		Drive:     "HDD",
		Folder:    "Albums/EmptyDoc",
		HasImages: false,
		Previews:  []string{},
		UpdatedAt: time.Now(),
	}

	if err := UpsertFolderMeta(fm1); err != nil {
		t.Fatalf("UpsertFolderMeta fm1 failed: %v", err)
	}
	if err := UpsertFolderMeta(fm2); err != nil {
		t.Fatalf("UpsertFolderMeta fm2 failed: %v", err)
	}

	// 2. Batch get
	batch, err := GetFoldersMetadataBatch("HDD", []string{"Albums/Cosplay", "Albums/EmptyDoc", "Albums/NonExistent"})
	if err != nil {
		t.Fatalf("GetFoldersMetadataBatch failed: %v", err)
	}
	if len(batch) != 2 {
		t.Fatalf("Expected 2 records, got %d", len(batch))
	}
	if !batch["Albums/Cosplay"].HasImages || len(batch["Albums/Cosplay"].Previews) != 2 {
		t.Fatalf("Unexpected fm1 data: %+v", batch["Albums/Cosplay"])
	}
	if batch["Albums/EmptyDoc"].HasImages || len(batch["Albums/EmptyDoc"].Previews) != 0 {
		t.Fatalf("Unexpected fm2 data: %+v", batch["Albums/EmptyDoc"])
	}

	// 3. Rename
	if err := RenameFolderMetadata("HDD", "Albums", "Collections"); err != nil {
		t.Fatalf("RenameFolderMetadata failed: %v", err)
	}
	batchRenamed, err := GetFoldersMetadataBatch("HDD", []string{"Collections/Cosplay", "Collections/EmptyDoc", "Albums/Cosplay"})
	if err != nil {
		t.Fatalf("GetFoldersMetadataBatch after rename failed: %v", err)
	}
	if len(batchRenamed) != 2 || batchRenamed["Collections/Cosplay"] == nil {
		t.Fatalf("RenameFolderMetadata didn't update folder_meta: %+v", batchRenamed)
	}

	// 4. Delete
	if err := DeleteFolderMetadata("HDD", "Collections/Cosplay"); err != nil {
		t.Fatalf("DeleteFolderMetadata failed: %v", err)
	}
	batchAfterDelete, err := GetFoldersMetadataBatch("HDD", []string{"Collections/Cosplay"})
	if err != nil {
		t.Fatalf("GetFoldersMetadataBatch after delete failed: %v", err)
	}
	if len(batchAfterDelete) != 0 {
		t.Fatalf("Expected 0 records after delete, got %d", len(batchAfterDelete))
	}
}
