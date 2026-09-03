package task

import "fmt"

type State string

const (
	Queued     State = "queued"
	Assigned   State = "assigned"
	Processing State = "processing"
	Completed  State = "completed"
	Failed     State = "failed"
)

func CanTransition(from, to State) bool {
	return map[State]map[State]bool{
		Queued:     {Assigned: true},
		Assigned:   {Processing: true, Queued: true, Failed: true},
		Processing: {Completed: true, Failed: true, Queued: true},
	}[from][to]
}

func ValidateTransition(from, to State) error {
	if !CanTransition(from, to) {
		return fmt.Errorf("invalid task transition: %s -> %s", from, to)
	}
	return nil
}
