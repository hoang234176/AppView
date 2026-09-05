import unittest
import io
import sys
from unittest.mock import patch
from logger import log_event, log_info, log_error, _format_event, _pad_level, _format_fields

class LoggerTests(unittest.TestCase):
    def test_pad_level(self):
        self.assertEqual(_pad_level("INFO"), "INFO ")
        self.assertEqual(_pad_level("WARN"), "WARN ")
        self.assertEqual(_pad_level("ERROR"), "ERROR")
        self.assertEqual(_pad_level("DEBUG"), "DEBUG")

    def test_format_event_basic(self):
        line = _format_event("INFO", "Download started: example.zip", "DOWNLOAD SERVICE")
        self.assertIn("INFO  [DOWNLOAD] Download started: example.zip", line)

    def test_format_event_subsystem_module(self):
        line = _format_event("INFO", "Client kết nối mới", "WEBSOCKET")
        self.assertIn("INFO  [DOWNLOAD] [WEBSOCKET] Client kết nối mới", line)

        line_coordinator = _format_event("INFO", "Connected", "COORDINATOR WORKER")
        self.assertIn("INFO  [DOWNLOAD] [COORDINATOR] Connected", line_coordinator)

    def test_format_event_redundant_prefixes(self):
        line1 = _format_event("INFO", "[DOWNLOAD SERVICE] Đã tạo task mới", "DOWNLOAD SERVICE")
        self.assertNotIn("[DOWNLOAD] [DOWNLOAD", line1)
        self.assertIn("[DOWNLOAD] Đã tạo task mới", line1)

        line2 = _format_event("INFO", "[DOWNLOAD] Đã tạo task mới", "DOWNLOAD")
        self.assertNotIn("[DOWNLOAD] [DOWNLOAD", line2)
        self.assertIn("[DOWNLOAD] Đã tạo task mới", line2)

    def test_format_event_error_code(self):
        line = _format_event("ERROR", "resolve task failed", "COORDINATOR WORKER", taskId="task-1", errorCode="RESOLVE_FAILED")
        self.assertIn("ERROR [DOWNLOAD] [COORDINATOR] resolve task failed | [RESOLVE_FAILED] taskId=task-1", line)

    def test_log_event_output(self):
        f = io.StringIO()
        with patch("sys.stdout", f):
            log_info("DOWNLOAD SERVICE", "Server ready")
        output = f.getvalue()
        self.assertIn("INFO  [DOWNLOAD] Server ready", output)

if __name__ == "__main__":
    unittest.main()
