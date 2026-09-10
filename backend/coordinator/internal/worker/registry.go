package worker

import (
	"sort"
	"sync"
	"time"

	"appview/coordinator/internal/protocol"
)

type Registry struct {
	mu      sync.RWMutex
	workers map[string]Worker
}

func NewRegistry() *Registry { return &Registry{workers: make(map[string]Worker)} }

// Register replaces a same-ID connection and returns whether an old session
// existed. The service decides how unfinished work should be requeued.
func (r *Registry) Register(id string, capabilities []protocol.Capability, sender Sender, now time.Time) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, replaced := r.workers[id]
	r.workers[id] = Worker{ID: id, Capabilities: append([]protocol.Capability(nil), capabilities...), Status: Idle, ConnectedAt: now, LastHeartbeat: now, Sender: sender}
	return replaced
}

func (r *Registry) Unregister(id string) (Worker, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	worker, ok := r.workers[id]
	if ok {
		delete(r.workers, id)
	}
	return worker.Clone(), ok
}

func (r *Registry) Get(id string) (Worker, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	worker, ok := r.workers[id]
	return worker.Clone(), ok
}

func (r *Registry) SetStatus(id string, status Status) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	worker, ok := r.workers[id]
	if !ok {
		return false
	}
	worker.Status = status
	r.workers[id] = worker
	return true
}

func (r *Registry) Heartbeat(id string, now time.Time) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	worker, ok := r.workers[id]
	if !ok {
		return false
	}
	worker.LastHeartbeat = now
	r.workers[id] = worker
	return true
}

func (r *Registry) IdleFor(action string) []Worker {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Worker, 0)
	for _, candidate := range r.workers {
		if candidate.Status == Idle && candidate.Supports(action) {
			result = append(result, candidate.Clone())
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}

func (r *Registry) AnyFor(action string) (Worker, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, candidate := range r.workers {
		if candidate.Supports(action) {
			return candidate.Clone(), true
		}
	}
	return Worker{}, false
}

func (r *Registry) StaleIDs(before time.Time) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0)
	for id, candidate := range r.workers {
		if candidate.LastHeartbeat.Before(before) {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids
}

func (r *Registry) Count() int { r.mu.RLock(); defer r.mu.RUnlock(); return len(r.workers) }
