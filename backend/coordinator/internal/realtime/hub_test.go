package realtime

import (
	"appview/coordinator/internal/protocol"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestHubFansOutAndRecoversAfterDisconnect(t *testing.T) {
	hub := NewHub()
	firstID, first := hub.Subscribe()
	secondID, second := hub.Subscribe()
	defer hub.Unsubscribe(secondID)
	event := protocol.FilesystemEvent{Type: "folder_created", Path: "albums/new", NewPath: "albums/new", ParentPath: "albums"}
	if count := hub.Broadcast(event); count != 2 {
		t.Fatalf("subscriber count = %d, want 2", count)
	}
	if got := <-first; got.Event == nil || *got.Event != event {
		t.Fatalf("first event = %#v, want %#v", got, event)
	}
	if got := <-second; got.Event == nil || *got.Event != event {
		t.Fatalf("second event = %#v, want %#v", got, event)
	}
	hub.Unsubscribe(firstID)
	event.Type = "folder_deleted"
	if count := hub.Broadcast(event); count != 1 {
		t.Fatalf("subscriber count after disconnect = %d, want 1", count)
	}
	if got := <-second; got.Event == nil || *got.Event != event {
		t.Fatalf("remaining subscriber event = %#v, want %#v", got, event)
	}
}

func TestRealtimeWebSocketBroadcastsDownloadEventsToTwoClients(t *testing.T) {
	hub := NewHub()
	mux := http.NewServeMux()
	NewServer(hub).Register(mux)
	server := httptest.NewServer(mux)
	defer server.Close()
	endpoint := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/events"
	first, _, err := websocket.DefaultDialer.Dial(endpoint, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, _, err := websocket.DefaultDialer.Dial(endpoint, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	waitForSubscribers(t, hub, 2)

	hub.BroadcastDownload(protocol.DownloadEvent{JobID: "job-1", Kind: "created"})
	assertDownloadEvent(t, first, "job-1", "created")
	assertDownloadEvent(t, second, "job-1", "created")
	hub.BroadcastDownload(protocol.DownloadEvent{JobID: "job-1", Kind: "state_changed"})
	assertDownloadEvent(t, first, "job-1", "state_changed")
	assertDownloadEvent(t, second, "job-1", "state_changed")
}

func waitForSubscribers(t *testing.T, hub *Hub, want int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for hub.SubscriberCount() != want {
		if time.Now().After(deadline) {
			t.Fatalf("subscriber count = %d, want %d", hub.SubscriberCount(), want)
		}
		time.Sleep(time.Millisecond)
	}
}

func assertDownloadEvent(t *testing.T, conn *websocket.Conn, id, kind string) {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	var message protocol.Message
	if err := conn.ReadJSON(&message); err != nil {
		t.Fatal(err)
	}
	if message.Type != protocol.DownloadEventMessage || message.DownloadEvent == nil || message.DownloadEvent.JobID != id || message.DownloadEvent.Kind != kind {
		t.Fatalf("event = %#v, want download_event %s/%s", message, id, kind)
	}
}

func TestRealtimeWebSocketWritesProtocolEnvelope(t *testing.T) {
	hub := NewHub()
	mux := http.NewServeMux()
	NewServer(hub).Register(mux)
	server := httptest.NewServer(mux)
	defer server.Close()

	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/ws/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	deadline := time.Now().Add(time.Second)
	for {
		if hub.Broadcast(protocol.FilesystemEvent{Type: "folder_deleted", OldPath: "albums/old"}) == 1 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("websocket subscriber did not register")
		}
		time.Sleep(time.Millisecond)
	}
	var message protocol.Message
	if err := conn.ReadJSON(&message); err != nil {
		t.Fatal(err)
	}
	if message.Type != protocol.FilesystemEventMessage || message.Event == nil || message.Event.Type != "folder_deleted" || message.Event.OldPath != "albums/old" {
		t.Fatalf("unexpected websocket envelope: %#v", message)
	}
}

func TestRealtimeWebSocketBroadcastsEveryFolderMutationToTwoClients(t *testing.T) {
	hub := NewHub()
	mux := http.NewServeMux()
	NewServer(hub).Register(mux)
	server := httptest.NewServer(mux)
	defer server.Close()
	endpoint := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/events"
	first, _, err := websocket.DefaultDialer.Dial(endpoint, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, _, err := websocket.DefaultDialer.Dial(endpoint, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()

	deadline := time.Now().Add(time.Second)
	for hub.SubscriberCount() != 2 {
		if time.Now().After(deadline) {
			t.Fatal("two websocket subscribers did not register")
		}
		time.Sleep(time.Millisecond)
	}
	hub.Broadcast(protocol.FilesystemEvent{Type: "folder_created", NewPath: "albums/created"})
	assertFilesystemEvent(t, first, "folder_created")
	assertFilesystemEvent(t, second, "folder_created")

	for _, eventType := range []string{"folder_renamed", "folder_moved", "folder_deleted"} {
		hub.Broadcast(protocol.FilesystemEvent{Type: eventType, OldPath: "albums/old", NewPath: "albums/new"})
		assertFilesystemEvent(t, first, eventType)
		assertFilesystemEvent(t, second, eventType)
	}
}

func assertFilesystemEvent(t *testing.T, conn *websocket.Conn, wantType string) {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	var message protocol.Message
	if err := conn.ReadJSON(&message); err != nil {
		t.Fatal(err)
	}
	if message.Type != protocol.FilesystemEventMessage || message.Event == nil || message.Event.Type != wantType {
		t.Fatalf("event = %#v, want filesystem_event/%s", message, wantType)
	}
}
