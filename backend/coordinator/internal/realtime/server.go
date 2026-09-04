package realtime

import (
	"github.com/gorilla/websocket"
	"net/http"
)

type Server struct {
	hub      *Hub
	upgrader websocket.Upgrader
}

func NewServer(hub *Hub) *Server {
	return &Server{hub: hub, upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}}
}
func (s *Server) Register(mux *http.ServeMux) { mux.HandleFunc("/ws/events", s.Handle) }
func (s *Server) Handle(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	id, events := s.hub.Subscribe()
	defer s.hub.Unsubscribe(id)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.NextReader(); err != nil {
				return
			}
		}
	}()
	for {
		select {
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := conn.WriteJSON(event); err != nil {
				return
			}
		case <-done:
			return
		}
	}
}
