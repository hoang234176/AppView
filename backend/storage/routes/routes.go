package routes

import (
	"backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	v1 := api.Group("/v1")
	{
		v1.Get("/ping", controllers.Ping)
		v1.Get("/drives", controllers.GetDrives)
		v1.Get("/folder", controllers.GetFolders)
		v1.Post("/folder", controllers.CreateFolder)
		v1.Post("/folder/create", controllers.CreateFolder)
		v1.Put("/folder/rename", controllers.RenameFolder)
		v1.Post("/folder/rename", controllers.RenameFolder)
		v1.Delete("/folder", controllers.DeleteFolder)
		v1.Post("/folder/delete", controllers.DeleteFolder)
		v1.Delete("/file", controllers.DeleteFile)
		v1.Post("/file/delete", controllers.DeleteFile)
		v1.Post("/item/move", controllers.HandleMoveItem)
		v1.Post("/items/batch", controllers.HandleBatchItems)
		v1.Get("/jobs/batch/:job_id", controllers.GetBatchJobStatus)

		// Primary requested drive routes: e.g. /api/v1/pictures/SSD/*, /api/v1/thumbnails/SSD/*, /api/v1/thumbnail/SSD/*
		v1.Get("/pictures/:drive/*", controllers.ServePicture)
		v1.Get("/picture/:drive/*", controllers.ServePicture)
		v1.Get("/thumbnails/:drive/*", controllers.ServeThumbnail)
		v1.Get("/thumbnail/:drive/*", controllers.ServeThumbnail)
		v1.Get("/videos/:drive/*", controllers.StreamVideo)
		v1.Get("/video/:drive/*", controllers.StreamVideo)

		// General fallback routes: /api/v1/pictures/*, /api/v1/thumbnails/*
		v1.Get("/pictures/*", controllers.ServePicture)
		v1.Get("/picture/*", controllers.ServePicture)
		v1.Get("/thumbnails/*", controllers.ServeThumbnail)
		v1.Get("/thumbnail/*", controllers.ServeThumbnail)
		v1.Get("/tree-folder", controllers.HandleGetTreeFolder)
		v1.Get("/videos", controllers.GetVideos)
		v1.Get("/videos/*", controllers.StreamVideo)
		v1.Get("/video/*", controllers.StreamVideo)

		// Alternative drive-prefix routes: /api/v1/SSD/pictures/*, /api/v1/SSD/thumbnails/*
		v1.Get("/:drive/pictures/*", controllers.ServePicture)
		v1.Get("/:drive/picture/*", controllers.ServePicture)
		v1.Get("/:drive/thumbnails/*", controllers.ServeThumbnail)
		v1.Get("/:drive/thumbnail/*", controllers.ServeThumbnail)
		v1.Get("/:drive/videos/*", controllers.StreamVideo)
		v1.Get("/:drive/video/*", controllers.StreamVideo)

		v1.Post("/jobs/convert", controllers.TriggerConvertJob)
		v1.Get("/jobs/convert/:job_id", controllers.GetConvertJobStatus)
		v1.Post("/jobs/archive", controllers.StartArchiveJob)
		v1.Get("/jobs/archive", controllers.ListArchiveJobs)
		v1.Get("/jobs/archive/:job_id", controllers.GetArchiveJob)
		v1.Post("/jobs/archive/:job_id/retry", controllers.RetryArchiveJob)
		v1.Post("/jobs/archive/:job_id/extract", controllers.RetryArchiveJobExtraction)
		v1.Post("/jobs/archive/:job_id/cancel", controllers.CancelArchiveJob)
		v1.Delete("/jobs/archive/:job_id", controllers.DeleteArchiveJob)
	}
}
