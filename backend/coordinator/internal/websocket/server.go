package websocket

import (
	"context"
	"net/http"
	"time"

	"appview/coordinator/internal/config"
	"appview/coordinator/internal/logging"
	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/service"
	"github.com/gorilla/websocket"
)

type Server struct {
	coordinator *service.Coordinator
	config      config.Config
	upgrader    websocket.Upgrader
}

func NewServer(coordinator *service.Coordinator, cfg config.Config) *Server {
	return &Server{coordinator: coordinator, config: cfg, upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}}
}
func (s *Server) Register(mux *http.ServeMux) { mux.HandleFunc(s.config.WorkerWebSocketPath, s.Handle) }
func (s *Server) Handle(writer http.ResponseWriter, request *http.Request) {
	socket, err := s.upgrader.Upgrade(writer, request, nil)
	if err != nil {
		logging.Event("WARN", "worker websocket upgrade failed", map[string]any{"error": err.Error()})
		return
	}
	connection := NewConnection(socket)
	defer connection.Close()
	workerID := ""
	defer func() {
		if workerID != "" {
			logging.Event("INFO", "worker websocket disconnected", map[string]any{"workerId": workerID})
			s.coordinator.WorkerDisconnected(workerID)
		}
	}()
	for {
		var message protocol.Message
		if err := socket.ReadJSON(&message); err != nil {
			logging.Event("DEBUG", "worker websocket read ended", map[string]any{"workerId": workerID, "error": err.Error()})
			return
		}
		registeredID, err := s.handleMessage(connection, workerID, message)
		if err != nil {
			logging.Event("WARN", "worker protocol message rejected", map[string]any{"workerId": workerID, "error": err.Error()})
			_ = connection.Send(protocol.NewError("INVALID_MESSAGE", err.Error()))
			continue
		}
		if registeredID != "" {
			workerID = registeredID
		}
	}
}
func (s *Server) handleMessage(connection *Connection, currentWorkerID string, message protocol.Message) (string, error) {
	if message.Type == protocol.WorkerRegister {
		if currentWorkerID != "" {
			return "", fmtError("worker already registered")
		}
		if err := s.coordinator.RegisterWorker(message.WorkerID, message.Capabilities, connection); err != nil {
			return "", err
		}
		if err := connection.Send(protocol.Message{Type: protocol.WorkerRegistered, WorkerID: message.WorkerID}); err != nil {
			return "", err
		}
		return message.WorkerID, nil
	}
	if currentWorkerID == "" {
		return "", fmtError("worker.register is required first")
	}
	if message.WorkerID != "" && message.WorkerID != currentWorkerID {
		return "", fmtError("workerId does not match connection")
	}
	switch message.Type {
	case protocol.WorkerHeartbeat:
		return "", s.coordinator.Heartbeat(currentWorkerID)
	case protocol.TaskAccepted:
		return "", s.coordinator.TaskAccepted(currentWorkerID, message.TaskID)
	case protocol.TaskProgress:
		return "", s.coordinator.TaskProgress(currentWorkerID, message.TaskID, message.Progress)
	case protocol.TaskCompleted:
		return "", s.coordinator.TaskCompleted(currentWorkerID, message.TaskID, message.Result)
	case protocol.TaskFailed:
		return "", s.coordinator.TaskFailed(currentWorkerID, message.TaskID, message.Error)
	case protocol.FilesystemEventMessage:
		return "", s.coordinator.FilesystemEvent(currentWorkerID, message.Event)
	default:
		return "", fmtError("unsupported message type")
	}
}
func (s *Server) RunHeartbeatMonitor(ctx context.Context) {
	ticker := time.NewTicker(s.config.HeartbeatCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.coordinator.RequeueStaleWorkers(s.config.HeartbeatTimeout)
		}
	}
}
func fmtError(message string) error { return &protocolError{message: message} }

type protocolError struct{ message string }

func (e *protocolError) Error() string { return e.message }
func (s *Server) LogStartup() {
	logging.Event("INFO", "coordinator worker websocket ready", map[string]any{"path": s.config.WorkerWebSocketPath})
}
