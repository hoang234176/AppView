package controllers

import (
	pythonapi "backend/api/python"
	"github.com/gofiber/fiber/v2"
)

type ArchiveJobRequest struct {
	TaskID      string `json:"task_id"`
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	Destination string `json:"destination"`
	Password    string `json:"password"`
}

func StartArchiveJob(c *fiber.Ctx) error {
	var req ArchiveJobRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "body không hợp lệ"})
	}
	if err := pythonapi.StartArchiveJob(req.TaskID, req.URL, req.Filename, req.Destination, req.Password); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	job, _ := pythonapi.GetArchiveJobSnapshot(req.TaskID)
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"job": job})
}

func GetArchiveJob(c *fiber.Ctx) error {
	job, ok := pythonapi.GetArchiveJobSnapshot(c.Params("job_id"))
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "không tìm thấy archive job"})
	}
	return c.JSON(fiber.Map{"job": job})
}

func ListArchiveJobs(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"jobs": pythonapi.GetArchiveJobSnapshots()})
}

func RetryArchiveJobExtraction(c *fiber.Ctx) error {
	var req struct {
		Password string `json:"password"`
	}
	_ = c.BodyParser(&req)
	if err := pythonapi.RetryArchiveExtraction(c.Params("job_id"), req.Password); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	job, _ := pythonapi.GetArchiveJobSnapshot(c.Params("job_id"))
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"job": job})
}

// RetryArchiveJob resumes only the earliest incomplete local stage. Storage
// chooses from its durable workspace (partial download, archive, or extracted
// result); the password is forwarded in-memory for this attempt only.
func RetryArchiveJob(c *fiber.Ctx) error {
	var req struct {
		Password string `json:"password"`
	}
	_ = c.BodyParser(&req)
	if err := pythonapi.RetryArchiveJob(c.Params("job_id"), req.Password); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	job, _ := pythonapi.GetArchiveJobSnapshot(c.Params("job_id"))
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"job": job})
}

func CancelArchiveJob(c *fiber.Ctx) error {
	if !pythonapi.CancelArchiveJob(c.Params("job_id")) {
		return c.Status(404).JSON(fiber.Map{"error": "không tìm thấy archive job"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
func DeleteArchiveJob(c *fiber.Ctx) error {
	pythonapi.DeleteArchiveJob(c.Params("job_id"))
	return c.SendStatus(fiber.StatusNoContent)
}
