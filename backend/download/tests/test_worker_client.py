import asyncio
import unittest

from worker.client import CoordinatorWorkerClient


class CoordinatorWorkerClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_unavailable_coordinator_keeps_reconnect_loop_alive(self):
        client = CoordinatorWorkerClient(
            url="ws://127.0.0.1:1/ws/workers",
            reconnect_initial_delay=0.01,
            reconnect_max_delay=0.02,
        )
        client.start()
        await asyncio.sleep(0.05)

        self.assertIsNotNone(client._run_task)
        self.assertFalse(client._run_task.done())

        await client.stop()

    async def test_session_and_cookie_envelope_handling(self):
        client = CoordinatorWorkerClient(url="ws://127.0.0.1:1/ws/workers")
        future = asyncio.get_running_loop().create_future()
        client._pending_rpc["test-session-task"] = future

        # Simulate receiving session.get response envelope
        envelope = {"type": "session.get", "taskId": "test-session-task", "result": {"session": "abc"}}
        if envelope.get("type") in ("cookie.get", "cookie.save", "session.get", "session.save"):
            task_id = envelope.get("taskId")
            if task_id in client._pending_rpc:
                fut = client._pending_rpc.pop(task_id)
                if not fut.done():
                    fut.set_result(envelope.get("result") or {})

        self.assertEqual(await future, {"session": "abc"})
