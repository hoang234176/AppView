package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"backend/configs"
	"backend/routes"
	"backend/utils"
	"backend/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
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

	// Poll archive mỗi giây là giao tiếp nội bộ Python -> Go, không phải log
	// thao tác người dùng. Ẩn riêng endpoint này để log tiến độ Python dễ đọc.
	app.Use(logger.New(logger.Config{
		Format:     "[HTTP] ${time} | ${status} | ${latency} | ${ip} | ${method} ${path} ${queryParams}\n",
		TimeFormat: "2006-01-02 15:04:05",
		TimeZone:   "Local",
		Next: func(c *fiber.Ctx) bool {
			return c.Method() == fiber.MethodGet && strings.HasPrefix(c.Path(), "/api/v1/jobs/archive/")
		},
	}))

	// Setup routes
	routes.SetupRoutes(app)
	storageWorker := worker.NewClient(worker.LoadConfig(), worker.NewHandler(nil))
	go storageWorker.Run(ctx)
	go func() {
		<-ctx.Done()
		_ = app.Shutdown()
	}()

	// Start the server
	utils.LogInfo("==================================================")
	utils.LogInfo("AppView Storage Server đang khởi chạy trên: http://0.0.0.0:8080")
	utils.LogInfo("Mọi yêu cầu & thao tác tệp/thư mục sẽ được in log đầy đủ tại Terminal này")
	utils.LogInfo("==================================================")

	if err := app.Listen("0.0.0.0:8080"); err != nil {
		log.Printf("Storage HTTP server stopped: %v", err)
	}
}
