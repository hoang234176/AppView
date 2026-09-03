package worker

import (
	"testing"
	"time"

	"appview/coordinator/internal/protocol"
)

type testSender struct{}

func (testSender) Send(protocol.Message) error { return nil }

func TestRegistryFindsIdleCapabilityWorker(t *testing.T) {
	registry := NewRegistry()
	now := time.Now()
	registry.Register("storage-02", []protocol.Capability{protocol.DownloadFile}, testSender{}, now)
	registry.Register("download-01", []protocol.Capability{protocol.ResolveDownload}, testSender{}, now)
	registry.SetStatus("storage-02", Busy)
	workers := registry.IdleFor(string(protocol.ResolveDownload))
	if len(workers) != 1 || workers[0].ID != "download-01" {
		t.Fatalf("unexpected workers: %#v", workers)
	}
}
