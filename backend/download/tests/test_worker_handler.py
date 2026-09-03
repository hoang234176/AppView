import unittest

from archive.contracts import ResolvedDownload
from worker.handler import DownloadWorkerHandler


class FakeResolver:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.urls = []

    async def resolve(self, url):
        self.urls.append(url)
        if self.error:
            raise self.error
        return self.result


class DownloadWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    async def _handle(self, envelope, resolver):
        sent = []

        async def send(event):
            sent.append(event)

        await DownloadWorkerHandler(resolver).handle(envelope, send)
        return sent

    async def test_resolve_download_completes_with_existing_resolver_result(self):
        resolved = ResolvedDownload(
            original_url="https://www.mediafire.com/file/example",
            download_url="https://download.mediafire.com/file.zip",
            filename="file.zip",
            extension="zip",
        )
        resolver = FakeResolver(result=resolved)
        sent = await self._handle(
            {"type": "task.assign", "taskId": "task-1", "action": "resolve_download", "payload": {"url": resolved.original_url}},
            resolver,
        )

        self.assertEqual(resolver.urls, [resolved.original_url])
        self.assertEqual(sent[0], {"type": "task.accepted", "taskId": "task-1"})
        self.assertEqual(sent[1]["type"], "task.completed")
        self.assertEqual(sent[1]["result"]["downloadUrl"], resolved.download_url)
        self.assertEqual(sent[1]["result"]["filename"], "file.zip")

    async def test_invalid_payload_fails_without_calling_resolver(self):
        resolver = FakeResolver()
        sent = await self._handle(
            {"type": "task.assign", "taskId": "task-2", "action": "resolve_download", "payload": {}},
            resolver,
        )

        self.assertEqual(resolver.urls, [])
        self.assertEqual(sent[0]["type"], "task.failed")
        self.assertEqual(sent[0]["error"]["code"], "INVALID_PAYLOAD")

    async def test_resolver_failure_maps_to_task_failed(self):
        resolver = FakeResolver(error=ValueError("unsupported URL"))
        sent = await self._handle(
            {"type": "task.assign", "taskId": "task-3", "action": "resolve_download", "payload": {"url": "https://example.test"}},
            resolver,
        )

        self.assertEqual(sent[0]["type"], "task.accepted")
        self.assertEqual(sent[1]["type"], "task.failed")
        self.assertEqual(sent[1]["error"]["code"], "RESOLVE_FAILED")

    async def test_unsupported_action_fails(self):
        resolver = FakeResolver()
        sent = await self._handle(
            {"type": "task.assign", "taskId": "task-4", "action": "convert_video", "payload": {"url": "https://example.test"}},
            resolver,
        )

        self.assertEqual(resolver.urls, [])
        self.assertEqual(sent[0]["type"], "task.failed")
        self.assertEqual(sent[0]["error"]["code"], "UNSUPPORTED_ACTION")
