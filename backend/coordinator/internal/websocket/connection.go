package websocket

import (
	"sync"

	"appview/coordinator/internal/protocol"
	"github.com/gorilla/websocket"
)

// Connection serializes all writes. Read ownership stays in Server.Handle.
type Connection struct {
	socket  *websocket.Conn
	writeMu sync.Mutex
}

func NewConnection(socket *websocket.Conn) *Connection { return &Connection{socket: socket} }
func (c *Connection) Send(message protocol.Message) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.socket.WriteJSON(message)
}
func (c *Connection) Close() error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.socket.Close()
}
