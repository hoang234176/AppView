package realtime

import (
	"appview/coordinator/internal/protocol"
	"sync"
)

// Hub is a bounded, best-effort invalidation fanout. Events are not history;
// a slow or disconnected client may miss one and must refetch after reconnect.
type Hub struct {
	mu          sync.Mutex
	next        uint64
	subscribers map[uint64]chan protocol.FilesystemEvent
}

func NewHub() *Hub { return &Hub{subscribers: make(map[uint64]chan protocol.FilesystemEvent)} }
func (h *Hub) Subscribe() (uint64, <-chan protocol.FilesystemEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.next++
	ch := make(chan protocol.FilesystemEvent, 16)
	h.subscribers[h.next] = ch
	return h.next, ch
}
func (h *Hub) Unsubscribe(id uint64) {
	h.mu.Lock()
	if ch, ok := h.subscribers[id]; ok {
		delete(h.subscribers, id)
		close(ch)
	}
	h.mu.Unlock()
}
func (h *Hub) Broadcast(event protocol.FilesystemEvent) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, ch := range h.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
	return len(h.subscribers)
}

func (h *Hub) SubscriberCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subscribers)
}
