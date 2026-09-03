package controllers

import (
	pythonapi "backend/api/python"
	"backend/configs"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
)

type ConvertJobRequest struct {
	TaskID string `json:"task_id"`
	Folder string `json:"folder"`
}

// TriggerConvertJob — POST /api/v1/jobs/convert
// Quét xong trước rồi trả về một job rõ ràng; việc convert tiếp tục chạy ngầm.
func TriggerConvertJob(c *fiber.Ctx) error {
	var req ConvertJobRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Body không hợp lệ: " + err.Error()})
	}
	if req.Folder == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Thiếu trường 'folder'"})
	}

	if filepath.IsAbs(req.Folder) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "folder phải là đường dẫn tương đối trong storage root"})
	}
	folderPath := filepath.Join(configs.DEFAULT_ROOT_PATH, filepath.Clean(req.Folder))
	rel, err := filepath.Rel(configs.DEFAULT_ROOT_PATH, folderPath)
	if err != nil || rel == ".." || (len(rel) > 3 && rel[:3] == ".."+string(filepath.Separator)) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "folder nằm ngoài storage root"})
	}

	taskID := req.TaskID
	if taskID == "" {
		taskID = folderPath
	}

	// StartConvertJob scan trước (nhanh), rồi convert ngầm, trả về total ngay
	total := pythonapi.StartConvertJob(taskID, folderPath)

	pythonapi.LogInfo("[CONVERT JOB] Nhận yêu cầu: task_id=%s folder=%s total=%d", taskID, folderPath, total)

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"job": fiber.Map{
			"id":    taskID,
			"state": map[bool]string{true: "completed", false: "converting"}[total == 0],
			"conversion": fiber.Map{
				"total": total,
			},
		},
	})
}

// GetConvertJobStatus — GET /api/v1/jobs/convert/:job_id
// Python polling endpoint để lấy tiến độ convert.
func GetConvertJobStatus(c *fiber.Ctx) error {
	jobID := c.Params("job_id")
	if jobID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Thiếu job_id"})
	}
	if pythonapi.GetConvertJob(jobID) == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Không tìm thấy job convert"})
	}

	total, current, failed, currentName, _, done := pythonapi.GetConvertJobSnapshot(jobID)
	state := "converting"
	if done {
		state = "completed"
	}

	return c.JSON(fiber.Map{
		"job": fiber.Map{
			"id":    jobID,
			"state": state,
			"conversion": fiber.Map{
				"total":        total,
				"current":      current,
				"failed":       failed,
				"current_name": currentName,
			},
		},
	})
}
