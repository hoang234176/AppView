import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from services.youtube.auth import create_cookiejar_from_netscape, verify_youtube_cookies
from worker.client import CoordinatorWorkerClient
from worker.protocol import COOKIE_GET, COOKIE_VERIFY, message


class TestSocialCookies(unittest.IsolatedAsyncioTestCase):
    def test_create_cookiejar_from_netscape(self):
        # Empty / whitespace
        self.assertIsNone(create_cookiejar_from_netscape(""))
        self.assertIsNone(create_cookiejar_from_netscape("   "))

        # Invalid content
        self.assertIsNone(create_cookiejar_from_netscape("invalid cookie text"))

        # Valid Netscape content
        valid_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\ttoken123\n"
            ".google.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid123\n"
        )
        jar = create_cookiejar_from_netscape(valid_netscape)
        self.assertIsNotNone(jar)
        cookies = list(jar)
        self.assertEqual(len(cookies), 2)
        cookie_names = {c.name for c in cookies}
        self.assertIn("LOGIN_INFO", cookie_names)
        self.assertIn("SID", cookie_names)

    async def test_verify_youtube_cookies_validation(self):
        # Empty
        valid, msg = await verify_youtube_cookies("")
        self.assertFalse(valid)
        self.assertIn("trống", msg)

        # Non-Netscape
        valid, msg = await verify_youtube_cookies("foo=bar")
        self.assertFalse(valid)
        self.assertIn("Định dạng", msg)

        # Netscape without youtube/google
        other_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".example.com\tTRUE\t/\tTRUE\t2147483647\tFOO\tBAR\n"
        )
        valid, msg = await verify_youtube_cookies(other_netscape)
        self.assertFalse(valid)
        self.assertIn("Không tìm thấy cookies cho youtube.com", msg)

    @patch("services.youtube.auth._test_youtube_cookies_sync")
    async def test_verify_youtube_cookies_mocked_success(self, mock_test):
        mock_test.return_value = (True, "Xác thực cookies YouTube thành công.")
        valid_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\ttoken123\n"
        )
        valid, msg = await verify_youtube_cookies(valid_netscape)
        self.assertTrue(valid)
        self.assertEqual(msg, "Xác thực cookies YouTube thành công.")

    async def test_worker_client_get_cookies_and_verify(self):
        client = CoordinatorWorkerClient()
        # When not connected, returns None
        self.assertIsNone(await client.get_cookies("youtube"))

        # Test _handle_cookie_verify
        sent = []
        client.send = AsyncMock(side_effect=lambda msg: sent.append(msg))
        with patch("services.youtube.auth.verify_youtube_cookies", new=AsyncMock(return_value=(True, "OK"))):
            await client._handle_cookie_verify({
                "type": COOKIE_VERIFY,
                "taskId": "req-verify-1",
                "payload": {"platform": "youtube", "cookies": "sample"},
            })
            self.assertEqual(len(sent), 1)
            self.assertEqual(sent[0]["type"], COOKIE_VERIFY)
            self.assertEqual(sent[0]["taskId"], "req-verify-1")
            self.assertTrue(sent[0]["result"]["valid"])
