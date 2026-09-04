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

		v1.Get("/pictures/*", controllers.ServePicture)
		v1.Get("/thumbnails/*", controllers.ServeThumbnail)
		v1.Get("/tree-folder", controllers.HandleGetTreeFolder)
		v1.Get("/videos", controllers.GetVideos)
		v1.Get("/videos/*", controllers.StreamVideo)

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
