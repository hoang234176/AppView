package worker

import (
	"context"
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"backend/events"
	"backend/utils"

	"github.com/gorilla/websocket"
)

type Config struct {
	URL                   string
	WorkerID              string
	HeartbeatInterval     time.Duration
	ReconnectInitialDelay time.Duration
	ReconnectMaxDelay     time.Duration
}

func LoadConfig() Config {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "local"
	}
	return Config{
		URL:                   stringEnv("STORAGE_COORDINATOR_WS_URL", stringEnv("COORDINATOR_WS_URL", "ws://localhost:8090/ws/workers")),
		WorkerID:              stringEnv("STORAGE_COORDINATOR_WORKER_ID", stringEnv("COORDINATOR_WORKER_ID", "storage-go-"+hostname)),
		HeartbeatInterval:     10 * time.Second,
		ReconnectInitialDelay: time.Second,
		ReconnectMaxDelay:     15 * time.Second,
	}
}

func stringEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

type Client struct {
	config  Config
	handler *Handler
	dialer  *websocket.Dialer
}

func NewClient(config Config, handler *Handler) *Client {
	if handler == nil {
		handler = NewHandler(nil)
	}
	return &Client{
		config:  config,
		handler: handler,
		dialer: &websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
			NetDialContext:   (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		},
	}
}

// Run reconnects indefinitely with bounded backoff. It is intended to run in
// a goroutine alongside Fiber; an unavailable Coordinator never stops HTTP.
func (c *Client) Run(ctx context.Context) {
	delay := c.config.ReconnectInitialDelay
	for ctx.Err() == nil {
		err := c.connectOnce(ctx)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			utils.LogEvent("WARN", "storage worker coordinator reconnect", map[string]any{"workerId": c.config.WorkerID, "delay": delay.String(), "error": err.Error()})
		} else {
			utils.LogEvent("WARN", "storage worker coordinator disconnected", map[string]any{"workerId": c.config.WorkerID, "delay": delay.String()})
		}
		if !waitContext(ctx, delay) {
			return
		}
		delay *= 2
		if delay > c.config.ReconnectMaxDelay {
			delay = c.config.ReconnectMaxDelay
		}
	}
}

func (c *Client) connectOnce(ctx context.Context) error {
	conn, _, err := c.dialer.DialContext(ctx, c.config.URL, nil)
	if err != nil {
		return err
	}
	defer conn.Close()

	safeConn := &serializedConnection{conn: conn}
	if err := safeConn.Send(Message{Type: WorkerRegister, WorkerID: c.config.WorkerID, Capabilities: c.handler.Capabilities()}); err != nil {
		return err
	}
	if err := conn.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return err
	}
	var registration Message
	if err := conn.ReadJSON(&registration); err != nil {
		return err
	}
	_ = conn.SetReadDeadline(time.Time{})
	if registration.Type == ProtocolError {
		if registration.Error != nil {
			return fmt.Errorf("Coordinator từ chối đăng ký: %s", registration.Error.Message)
		}
		return fmt.Errorf("Coordinator từ chối đăng ký")
	}
	if registration.Type != WorkerRegistered || registration.WorkerID != c.config.WorkerID {
		return fmt.Errorf("Coordinator trả acknowledgement đăng ký không hợp lệ")
	}

	utils.LogEvent("INFO", "storage worker registered", map[string]any{"workerId": c.config.WorkerID, "capability": CapabilityDownloadFile})
	// Coordinator has no local filesystem access. Send the Storage-owned,
	// password-free history after every registration so it can rebuild its
	// public projection after a remote restart.
	if err := safeConn.Send(Message{Type: StorageHistory, WorkerID: c.config.WorkerID, StorageHistory: ptrHistory(c.handler.History())}); err != nil {
		return err
	}
	if info, err := CurrentStorageInfo(); err == nil {
		_ = safeConn.Send(Message{Type: StorageInfoMessage, WorkerID: c.config.WorkerID, StorageInfo: &info})
	}
	events.SetPublisher(func(event events.FilesystemEvent) error {
		return safeConn.Send(Message{Type: FilesystemEvent, WorkerID: c.config.WorkerID, Event: &event})
	})
	defer events.SetPublisher(nil)
	connectionCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	closeOnContextDone := make(chan struct{})
	go func() {
		select {
		case <-connectionCtx.Done():
			_ = conn.Close()
		case <-closeOnContextDone:
		}
	}()
	var assignments sync.WaitGroup
	heartbeatDone := make(chan struct{})
	go c.heartbeat(connectionCtx, safeConn, heartbeatDone)
	defer func() {
		close(closeOnContextDone)
		cancel()
		<-heartbeatDone
		assignments.Wait()
	}()

	for {
		var incoming Message
		if err := conn.ReadJSON(&incoming); err != nil {
			return err
		}
		switch incoming.Type {
		case TaskAssign:
			utils.LogEvent("INFO", "storage worker received assignment", map[string]any{"workerId": c.config.WorkerID, "taskId": incoming.TaskID, "action": incoming.Action})
			assignments.Add(1)
			go func(task Message) {
				defer assignments.Done()
				c.handler.Handle(connectionCtx, task, safeConn.Send)
			}(incoming)
		case CookieStatus, CookieSave, CookieGet:
			go c.handler.HandleCookieMessage(incoming, safeConn.Send)
		case ProtocolError:
			if incoming.Error != nil {
				utils.LogEvent("WARN", "storage worker coordinator protocol error", map[string]any{"workerId": c.config.WorkerID, "error": incoming.Error.Message})
			}
		}
	}
}

func ptrHistory(history StorageHistoryPayload) *StorageHistoryPayload { return &history }

func (c *Client) heartbeat(ctx context.Context, conn *serializedConnection, done chan<- struct{}) {
	defer close(done)
	ticker := time.NewTicker(c.config.HeartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := conn.Send(Message{Type: WorkerHeartbeat, WorkerID: c.config.WorkerID}); err != nil {
				return
			}
		}
	}
}

type serializedConnection struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *serializedConnection) Send(message Message) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.conn.WriteJSON(message); err != nil {
		_ = c.conn.Close()
		return err
	}
	return nil
}

func waitContext(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
