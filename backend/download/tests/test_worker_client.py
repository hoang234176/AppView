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
