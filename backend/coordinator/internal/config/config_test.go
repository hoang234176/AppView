package config

import "testing"

func TestLoadUsesRenderPortWhenAddressIsUnset(t *testing.T) {
	t.Setenv("COORDINATOR_HTTP_ADDR", "")
	t.Setenv("PORT", "18090")

	cfg := Load()
	if cfg.HTTPAddress != "0.0.0.0:18090" {
		t.Fatalf("HTTPAddress = %q, want Render port address", cfg.HTTPAddress)
	}
}

func TestLoadPrefersExplicitCoordinatorAddress(t *testing.T) {
	t.Setenv("COORDINATOR_HTTP_ADDR", ":19090")
	t.Setenv("PORT", "18090")

	cfg := Load()
	if cfg.HTTPAddress != ":19090" {
		t.Fatalf("HTTPAddress = %q, want explicit address", cfg.HTTPAddress)
	}
}
