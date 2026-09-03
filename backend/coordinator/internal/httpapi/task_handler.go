package httpapi

import (
	"encoding/json"
	"net/http"

	"appview/coordinator/internal/service"
)

type TaskHandler struct{ coordinator *service.Coordinator }
type createTaskRequest struct {
	Action      string          `json:"action"`
	Payload     json.RawMessage `json:"payload"`
	Retryable   *bool           `json:"retryable,omitempty"`
	MaxAttempts int             `json:"maxAttempts,omitempty"`
}

func NewTaskHandler(coordinator *service.Coordinator) *TaskHandler {
	return &TaskHandler{coordinator: coordinator}
}
func (h *TaskHandler) Create(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body createTaskRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	retryable := true
	if body.Retryable != nil {
		retryable = *body.Retryable
	}
	created, err := h.coordinator.CreateTask(body.Action, body.Payload, retryable, body.MaxAttempts)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusAccepted, created)
}
func (h *TaskHandler) Get(writer http.ResponseWriter, request *http.Request) {
	found, ok := h.coordinator.GetTask(request.PathValue("id"))
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}
	writeJSON(writer, http.StatusOK, found)
}
func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}
