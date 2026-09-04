package worker

import (
	"testing"

	"backend/configs"
)

func TestCurrentStorageInfoUsesConfiguredRootAndDerivedName(t *testing.T) {
	old := configs.DEFAULT_ROOT_PATH
	configs.DEFAULT_ROOT_PATH = t.TempDir()
	defer func() { configs.DEFAULT_ROOT_PATH = old }()
	info, err := CurrentStorageInfo()
	if err != nil {
		t.Fatal(err)
	}
	if info.DisplayName == "HDD" || info.DisplayName == "" {
		t.Fatalf("display name must derive from configured root: %#v", info)
	}
	if info.TotalBytes <= 0 || info.UsedBytes < 0 || info.AvailableBytes < 0 {
		t.Fatalf("invalid usage: %#v", info)
	}
}
