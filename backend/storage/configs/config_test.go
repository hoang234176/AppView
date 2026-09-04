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
	dir, err := AppViewStateDir()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(dir) != ".tmp-appview" || !filepath.IsAbs(dir) {
		t.Fatalf("unexpected state dir %q", dir)
	}
}
