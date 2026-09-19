package configs

import (
	"path/filepath"
	"testing"
)

func TestAppViewStateDirUsesOverride(t *testing.T) {
	t.Setenv("APPVIEW_STATE_DIR", "/tmp/appview-state")
	dir, err := AppViewStateDir()
	if err != nil {
		t.Fatal(err)
	}
	if dir != "/tmp/appview-state" {
		t.Fatalf("state dir = %q", dir)
	}
}

func TestAppViewStateDirDefaultsUnderCurrentHome(t *testing.T) {
	t.Setenv("APPVIEW_STATE_DIR", "")
	t.Setenv("STORAGE_STATE_DIR", "")
	dir, err := AppViewStateDir()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(dir) != ".tmp-appview" || !filepath.IsAbs(dir) {
		t.Fatalf("unexpected state dir %q", dir)
	}
}

func TestStorageStateDirTakesPrecedence(t *testing.T) {
	t.Setenv("STORAGE_STATE_DIR", "/tmp/storage-priority")
	t.Setenv("APPVIEW_STATE_DIR", "/tmp/appview-fallback")
	dir, err := AppViewStateDir()
	if err != nil {
		t.Fatal(err)
	}
	if dir != "/tmp/storage-priority" {
		t.Fatalf("state dir = %q, want /tmp/storage-priority", dir)
	}
}

func TestStorageRootPathEnvOverride(t *testing.T) {
	old := DEFAULT_ROOT_PATH
	defer func() { DEFAULT_ROOT_PATH = old }()

	t.Setenv("STORAGE_ROOT_PATH", "/custom/storage/path")
	t.Setenv("ROOT_PATH", "/other/path")
	InitDefaultRootPath()
	if DEFAULT_ROOT_PATH != "/custom/storage/path" {
		t.Fatalf("expected DEFAULT_ROOT_PATH = '/custom/storage/path', got %q", DEFAULT_ROOT_PATH)
	}
}

func TestRootPathFallbackEnvOverride(t *testing.T) {
	old := DEFAULT_ROOT_PATH
	defer func() { DEFAULT_ROOT_PATH = old }()

	t.Setenv("STORAGE_ROOT_PATH", "")
	t.Setenv("ROOT_PATH", "/custom/fallback/path")
	InitDefaultRootPath()
	if DEFAULT_ROOT_PATH != "/custom/fallback/path" {
		t.Fatalf("expected DEFAULT_ROOT_PATH = '/custom/fallback/path', got %q", DEFAULT_ROOT_PATH)
	}
}

func TestDefaultRootPathFallback(t *testing.T) {
	old := DEFAULT_ROOT_PATH
	defer func() { DEFAULT_ROOT_PATH = old }()

	t.Setenv("STORAGE_ROOT_PATH", "")
	t.Setenv("ROOT_PATH", "")
	InitDefaultRootPath()
	if DEFAULT_ROOT_PATH != "/Volumes/HDD" {
		t.Fatalf("expected DEFAULT_ROOT_PATH = '/Volumes/HDD', got %q", DEFAULT_ROOT_PATH)
	}
}

func TestStorageDrivesParsing(t *testing.T) {
	oldDrives := STORAGE_DRIVES
	defer func() { STORAGE_DRIVES = oldDrives }()

	t.Setenv("STORAGE_DRIVES", "HDD:/Volumes/HDD,SSD:/Volumes/SSD,Custom:/Volumes/CustomDrive")
	InitDefaultRootPath()
	if len(STORAGE_DRIVES) != 3 {
		t.Fatalf("expected 3 drives, got %d", len(STORAGE_DRIVES))
	}
	if STORAGE_DRIVES[0].ID != "HDD" || STORAGE_DRIVES[0].Path != "/Volumes/HDD" {
		t.Fatalf("unexpected drive 0: %+v", STORAGE_DRIVES[0])
	}
	if STORAGE_DRIVES[1].ID != "SSD" || STORAGE_DRIVES[1].Path != "/Volumes/SSD" {
		t.Fatalf("unexpected drive 1: %+v", STORAGE_DRIVES[1])
	}
	if STORAGE_DRIVES[2].ID != "Custom" || STORAGE_DRIVES[2].Path != "/Volumes/CustomDrive" {
		t.Fatalf("unexpected drive 2: %+v", STORAGE_DRIVES[2])
	}
}
