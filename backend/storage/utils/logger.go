package utils

import (
	"fmt"
	"time"
)

func LogInfo(format string, a ...interface{}) {
	now := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf(format, a...)
	fmt.Printf("[INFO] [%s] %s\n", now, msg)
}

func LogError(format string, a ...interface{}) {
	now := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf(format, a...)
	fmt.Printf("[ERROR] [%s] %s\n", now, msg)
}

func LogWarning(format string, a ...interface{}) {
	now := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf(format, a...)
	fmt.Printf("[WARNING] [%s] %s\n", now, msg)
}

func LogDebug(format string, a ...interface{}) {
	now := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf(format, a...)
	fmt.Printf("[DEBUG] [%s] %s\n", now, msg)
}
