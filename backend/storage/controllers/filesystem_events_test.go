package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"backend/events"

	"github.com/gofiber/fiber/v2"
)

func TestFolderMutationsPublishEventsOnlyAfterSuccess(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"source", "destination"} {
		if err := os.Mkdir(filepath.Join(root, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}

	var received []events.FilesystemEvent
	events.SetPublisher(func(event events.FilesystemEvent) error {
		received = append(received, event)
		return nil
	})
	defer events.SetPublisher(nil)

	app := fiber.New()
	app.Post("/folder", CreateFolder)
	app.Put("/folder/rename", RenameFolder)
	app.Post("/item/move", HandleMoveItem)
	app.Delete("/folder", DeleteFolder)

	requestFolderMutation(t, app, http.MethodPost, "/folder?root_path="+root, map[string]string{"path": "source", "name": "created"}, fiber.StatusOK)
	requestFolderMutation(t, app, http.MethodPut, "/folder/rename?root_path="+root, map[string]string{"path": "source/created", "new_name": "renamed"}, fiber.StatusOK)
	requestFolderMutation(t, app, http.MethodPost, "/item/move?root_path="+root, map[string]string{"src": "source/renamed", "dest": "destination"}, fiber.StatusOK)
	requestFolderMutation(t, app, http.MethodDelete, "/folder?root_path="+root+"&path=destination/renamed", nil, fiber.StatusOK)

	want := []events.FilesystemEvent{
		{Type: "folder_created", Path: "source/created", NewPath: "source/created", ParentPath: "source"},
		{Type: "folder_renamed", OldPath: "source/created", NewPath: "source/renamed", OldParentPath: "source", NewParentPath: "source", ParentPath: "source"},
		{Type: "folder_moved", OldPath: "source/renamed", NewPath: "destination/renamed", OldParentPath: "source", NewParentPath: "destination", ParentPath: "destination"},
		{Type: "folder_deleted", Path: "destination/renamed", OldPath: "destination/renamed", ParentPath: "destination", OldParentPath: "destination"},
	}
	if len(received) != len(want) {
		t.Fatalf("received %d events, want %d: %#v", len(received), len(want), received)
	}
	for i := range want {
		if received[i] != want[i] {
			t.Fatalf("event %d = %#v, want %#v", i, received[i], want[i])
		}
	}

	requestFolderMutation(t, app, http.MethodPost, "/folder?root_path="+root, map[string]string{"path": "", "name": "source"}, fiber.StatusBadRequest)
	if len(received) != len(want) {
		t.Fatalf("failed mutation emitted an event: %#v", received)
	}
}

func requestFolderMutation(t *testing.T, app *fiber.App, method, target string, payload map[string]string, wantStatus int) {
	t.Helper()
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, target, body)
	request.Header.Set("Content-Type", "application/json")
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != wantStatus {
		t.Fatalf("%s %s status = %d, want %d", method, target, response.StatusCode, wantStatus)
	}
}
