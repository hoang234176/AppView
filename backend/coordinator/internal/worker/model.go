package worker

import (
	"time"

	"appview/coordinator/internal/protocol"
)

type Status string

const (
	Idle Status = "idle"
	Busy Status = "busy"
)

// Sender is owned by the WebSocket transport. Registries only retain it as a
// handle; they never perform network I/O while holding their mutex.
type Sender interface {
	Send(protocol.Message) error
}

type Worker struct {
	ID            string
	Capabilities  []protocol.Capability
	Status        Status
	ActiveTasks   int
	MaxConcurrent int
	ConnectedAt   time.Time
	LastHeartbeat time.Time
	Sender        Sender
}

func (w Worker) Supports(action string) bool {
	for _, capability := range w.Capabilities {
		if string(capability) == action {
			return true
		}
	}
	return false
}

func (w Worker) IsAvailable(action string) bool {
	if !w.Supports(action) {
		return false
	}
	if w.Status == Busy {
		return false
	}
	maxConcurrent := w.MaxConcurrent
	if maxConcurrent <= 0 {
		maxConcurrent = 50
	}
	return w.ActiveTasks < maxConcurrent
}

func (w Worker) Clone() Worker {
	w.Capabilities = append([]protocol.Capability(nil), w.Capabilities...)
	return w
}
