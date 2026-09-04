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
	if got := <-first; got != event {
		t.Fatalf("first event = %#v, want %#v", got, event)
	}
	if got := <-second; got != event {
		t.Fatalf("second event = %#v, want %#v", got, event)
	}
	hub.Unsubscribe(firstID)
	event.Type = "folder_deleted"
	if count := hub.Broadcast(event); count != 1 {
		t.Fatalf("subscriber count after disconnect = %d, want 1", count)
	}
	if got := <-second; got != event {
		t.Fatalf("remaining subscriber event = %#v, want %#v", got, event)
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
