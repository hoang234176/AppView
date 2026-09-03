package scheduler

import (
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

// Scheduler only selects; dispatching a WebSocket message belongs to service.
type Scheduler struct{}

func New() *Scheduler { return &Scheduler{} }
func (s *Scheduler) Select(task task.Task, candidates []worker.Worker) (worker.Worker, bool) {
	if len(candidates) == 0 {
		return worker.Worker{}, false
	}
	return candidates[0], true // Registry provides deterministic ID ordering.
}
