package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"appview/coordinator/internal/config"
	"appview/coordinator/internal/httpapi"
	"appview/coordinator/internal/logging"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/service"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/websocket"
	"appview/coordinator/internal/worker"
)

func main() {
	cfg := config.Load()
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), cfg.DefaultMaxAttempts)
	mux := http.NewServeMux()
	httpapi.Register(mux, coordinator)
	workerWS := websocket.NewServer(coordinator, cfg)
	workerWS.Register(mux)
	workerWS.LogStartup()

	server := &http.Server{Addr: cfg.HTTPAddress, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go workerWS.RunHeartbeatMonitor(ctx)
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	logging.Event("INFO", "coordinator starting", map[string]any{"listenAddress": cfg.HTTPAddress})
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logging.Event("ERROR", "coordinator server stopped unexpectedly", map[string]any{"error": err.Error()})
		return
	}
	logging.Event("INFO", "coordinator stopped", nil)
}
