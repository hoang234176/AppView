package worker

import (
	"testing"
)

func TestCurrentStorageInfoUsesConfiguredRootAndDerivedName(t *testing.T) {
	info, err := CurrentStorageInfo()
	if err != nil {
		t.Fatal(err)
	}
	if len(info.Drives) == 0 {
		t.Fatalf("drives should not be empty: %#v", info)
	}
}
