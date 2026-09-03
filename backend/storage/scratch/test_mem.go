package main

import (
	"fmt"
	"runtime"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

func printMem() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("Alloc = %v MiB, TotalAlloc = %v MiB, Sys = %v MiB, NumGC = %v\n",
		m.Alloc/1024/1024, m.TotalAlloc/1024/1024, m.Sys/1024/1024, m.NumGC)
}

func main() {
	app := fiber.New()

	fullPath := "/Volumes/HDD/Albums/drama/Chinese Short Drama After I was reborn, I began my revenge..mp4"

	app.Get("/stream", func(c *fiber.Ctx) error {
		fasthttp.ServeFile(c.Context(), fullPath)
		printMem()
		return nil
	})

	fmt.Println("Listening on :8089...")
	app.Listen(":8089")
}
