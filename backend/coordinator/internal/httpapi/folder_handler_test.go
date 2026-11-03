package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/service"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

type folderRpcMockSender struct {
	coordinator *service.Coordinator
}

func (s *folderRpcMockSender) Send(msg protocol.Message) error {
	if msg.Type == protocol.FolderTreeGet {
		go func(taskID string) {
			res := protocol.FolderTreeResult{
				Data: []*protocol.FolderNode{
					{
						Type: "folder",
						Name: "TestFolder",
						Path: "TestFolder",
					},
				},
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderTreeGet,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	} else if msg.Type == protocol.FolderContentsGet {
		go func(taskID string) {
			res := protocol.FolderContentsResult{
				CurrentPath: "",
				Folders: []*protocol.FolderItem{
					{
						ID:   "f-1",
						Name: "SubDir",
						Path: "SubDir",
					},
				},
				Pictures: []*protocol.PictureItem{
					{
						ID:   "p-1",
						Name: "photo.jpg",
						Path: "photo.jpg",
					},
				},
				TotalFolders:  1,
				TotalPictures: 1,
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderContentsGet,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	} else if msg.Type == protocol.FolderCreate {
		go func(taskID string) {
			res := protocol.FolderCreateResult{
				Message: "Folder created successfully",
				Data: &protocol.FolderItem{
					Name: "NewSubFolder",
					Path: "test/NewSubFolder",
				},
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderCreate,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	} else if msg.Type == protocol.FolderRename {
		go func(taskID string) {
			res := protocol.FolderRenameResult{
				Message: "Folder renamed successfully",
				Data: &protocol.FolderItem{
					Name: "RenamedFolder",
					Path: "test/RenamedFolder",
				},
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderRename,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	} else if msg.Type == protocol.FolderStatsGet {
		go func(taskID string) {
			res := protocol.FolderStatsResult{
				Drive:          "SSD",
				Path:           "test/sub",
				TotalSize:      1048576,
				TotalFiles:     10,
				TotalPictures:  8,
				TotalVideos:    2,
				TotalFolders:   3,
				LatestMod:      1700000000,
				DirectFolders:  1,
				DirectPictures: 0,
				DirectVideos:   0,
				DirectTotal:    1,
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderStatsGet,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	} else if msg.Type == protocol.FolderDelete {
		go func(taskID string) {
			res := protocol.FolderDeleteResult{
				Drive:   "SSD",
				Path:    "test/sub",
				Deleted: true,
			}
			resRaw, _ := json.Marshal(res)
			s.coordinator.ResolveRPC(taskID, protocol.Message{
				Type:   protocol.FolderDelete,
				TaskID: taskID,
				Result: resRaw,
			})
		}(msg.TaskID)
	}
	return nil
}

func TestGetTreeFolderNoStorageWorker(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/tree-folder?drive=HDD", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable, got %d", response.Code)
	}
}

func TestGetTreeFolderSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/tree-folder?drive=HDD", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", response.Code, response.Body.String())
	}

	var body struct {
		Message string                 `json:"message"`
		Data    []*protocol.FolderNode `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if body.Message != "Success" {
		t.Fatalf("expected message 'Success', got %q", body.Message)
	}
	if len(body.Data) != 1 || body.Data[0].Name != "TestFolder" {
		t.Fatalf("expected 1 folder with Name 'TestFolder', got %+v", body.Data)
	}
}

func TestGetFolderSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/folder?drive=SSD&path=test", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", response.Code, response.Body.String())
	}

	var body struct {
		Message string                         `json:"message"`
		Data    *protocol.FolderContentsResult `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if body.Message != "Success" {
		t.Fatalf("expected message 'Success', got %q", body.Message)
	}
	if body.Data.TotalFolders != 1 || len(body.Data.Folders) != 1 || body.Data.Folders[0].Name != "SubDir" {
		t.Fatalf("expected 1 folder SubDir, got %+v", body.Data.Folders)
	}
	if body.Data.TotalPictures != 1 || len(body.Data.Pictures) != 1 || body.Data.Pictures[0].Name != "photo.jpg" {
		t.Fatalf("expected 1 picture photo.jpg, got %+v", body.Data.Pictures)
	}
}

func TestCreateFolderSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	payload := `{"drive":"SSD","path":"test","name":"NewSubFolder"}`
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/v1/folder", strings.NewReader(payload)))
	if response.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", response.Code, response.Body.String())
	}

	var body protocol.FolderCreateResult
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if body.Data == nil || body.Data.Name != "NewSubFolder" {
		t.Fatalf("expected folder data with Name 'NewSubFolder', got %+v", body.Data)
	}
}

func TestCreateFolderEmptyName(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	payload := `{"drive":"SSD","path":"test","name":""}`
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/v1/folder", strings.NewReader(payload)))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", response.Code, response.Body.String())
	}
}

func TestGetFolderStatsSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/folder/stats?drive=SSD&path=test/sub", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", response.Code, response.Body.String())
	}

	var body struct {
		Message string                     `json:"message"`
		Data    protocol.FolderStatsResult `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if body.Data.TotalSize != 1048576 || body.Data.TotalFiles != 10 || body.Data.DirectFolders != 1 || body.Data.DirectTotal != 1 {
		t.Fatalf("expected valid folder stats, got %+v", body.Data)
	}
}

func TestRenameFolderSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	payload := `{"drive":"SSD","path":"test/OldFolder","new_name":"RenamedFolder"}`
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/api/v1/folder", strings.NewReader(payload)))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", response.Code, response.Body.String())
	}

	var body protocol.FolderRenameResult
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if body.Data == nil || body.Data.Name != "RenamedFolder" {
		t.Fatalf("expected folder data with Name 'RenamedFolder', got %+v", body.Data)
	}
}

func TestRenameFolderEmptyName(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	payload := `{"drive":"SSD","path":"test/OldFolder","new_name":""}`
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/api/v1/folder", strings.NewReader(payload)))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", response.Code, response.Body.String())
	}
}

func TestDeleteFolderSuccess(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &folderRpcMockSender{coordinator: coordinator}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	// 1. Test DELETE /api/v1/folder?drive=SSD&path=test/sub
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodDelete, "/api/v1/folder?drive=SSD&path=test/sub", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", response.Code, response.Body.String())
	}

	var body struct {
		Message string                      `json:"message"`
		Data    protocol.FolderDeleteResult `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}
	if !body.Data.Deleted || body.Data.Path != "test/sub" {
		t.Fatalf("expected valid folder delete result, got %+v", body.Data)
	}

	// 2. Test POST /api/v1/folder/delete
	postResponse := httptest.NewRecorder()
	mux.ServeHTTP(postResponse, httptest.NewRequest(http.MethodPost, "/api/v1/folder/delete?drive=SSD&path=test/sub", nil))
	if postResponse.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", postResponse.Code, postResponse.Body.String())
	}
}

func TestDeleteFolderRootRejected(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodDelete, "/api/v1/folder?drive=SSD&path=", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", response.Code, response.Body.String())
	}
}
