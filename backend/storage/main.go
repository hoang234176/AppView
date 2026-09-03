package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/configs"
	"backend/routes"
	"backend/utils"
	"backend/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	configs.LoadEnvironment()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Create a new Fiber app
	app := fiber.New(fiber.Config{
		AppName: "AppView Storage Microservice",
	})

	// Enable CORS middleware
	app.Use(cors.New())

	app.Use(func(c *fiber.Ctx) error {
		started := time.Now()
		err := c.Next()
		// Archive polling is internal and high-frequency; progress is logged by
		// the Python/Storage job layers instead of repeating HTTP lines.
		if !(c.Method() == fiber.MethodGet && len(c.Path()) >= len("/api/v1/jobs/archive/") && c.Path()[:len("/api/v1/jobs/archive/")] == "/api/v1/jobs/archive/") {
			utils.LogEvent("INFO", "http request", map[string]any{"method": c.Method(), "path": c.Path(), "status": c.Response().StatusCode(), "latencyMs": time.Since(started).Milliseconds()})
		}
		return err
	})

	// Setup routes
	routes.SetupRoutes(app)
	storageWorker := worker.NewClient(worker.LoadConfig(), worker.NewHandler(nil))
	go storageWorker.Run(ctx)
	go func() {
		<-ctx.Done()
		_ = app.Shutdown()
	}()

	// Start the server
	utils.LogEvent("INFO", "storage service starting", map[string]any{"listenAddress": "0.0.0.0:8080"})

	if err := app.Listen("0.0.0.0:8080"); err != nil {
		utils.LogEvent("ERROR", "storage HTTP server stopped", map[string]any{"error": err.Error()})
	}
	utils.LogEvent("INFO", "storage service stopped", nil)
}
