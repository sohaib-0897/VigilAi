import json
import logging
from collections.abc import AsyncIterator

import redis.asyncio as redis

from vigilai_api.core.config import get_settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connections and provides pub/sub utilities."""

    def __init__(self, url: str):
        self.url = url
        self.client: redis.Redis | None = None
        self.pubsub = None
        self.bytes_client = None

    async def connect(self) -> None:
        self.client = redis.from_url(self.url, decode_responses=True)
        # We need a separate client for raw bytes (like MJPEG frames)
        self.bytes_client = redis.from_url(self.url, decode_responses=False)
        self.pubsub = self.client.pubsub()
        logger.info("Connected to Redis.")

    async def disconnect(self) -> None:
        if self.pubsub:
            if hasattr(self.pubsub, "aclose"):
                await self.pubsub.aclose()
            else:
                await self.pubsub.close()
        if self.client:
            await self.client.aclose()
        if self.bytes_client:
            await self.bytes_client.aclose()
        logger.info("Disconnected from Redis.")

    async def publish(self, channel: str, message: dict) -> None:
        if self.client:
            await self.client.publish(channel, json.dumps(message))

    async def subscribe(self, channel: str) -> AsyncIterator[dict]:
        if not self.client:
            return
        async with self.client.pubsub() as subscription:
            await subscription.subscribe(channel)
            async for message in subscription.listen():
                if message["type"] == "message":
                    yield json.loads(message["data"])

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        if self.client:
            await self.client.set(key, value, ex=ex)

    async def get(self, key: str) -> str | None:
        if self.client:
            return await self.client.get(key)
        return None

    async def delete(self, key: str) -> None:
        if self.client:
            await self.client.delete(key)

    async def set_camera_frame(self, camera_id: str, frame_bytes: bytes) -> None:
        if self.bytes_client:
            key = f"vigilai:camera:{camera_id}:frame"
            await self.bytes_client.set(key, frame_bytes, ex=5)  # Auto-expire frames if not updated

    async def get_camera_frame(self, camera_id: str) -> bytes | None:
        if self.bytes_client:
            key = f"vigilai:camera:{camera_id}:frame"
            return await self.bytes_client.get(key)
        return None

    async def set_camera_status(self, camera_id: str, status: dict) -> None:
        key = f"vigilai:camera:{camera_id}:status"
        await self.set(key, json.dumps(status), ex=30)

    async def get_camera_status(self, camera_id: str) -> dict | None:
        key = f"vigilai:camera:{camera_id}:status"
        val = await self.get(key)
        if val:
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                pass
        return None

    async def publish_event(self, event: dict) -> None:
        await self.publish("vigilai:events", event)

    async def publish_camera_command(self, camera_id: str, command: str) -> None:
        channel = f"vigilai:camera:{camera_id}:command"
        await self.publish(channel, {"command": command})


# Global instance initialized in main.py
redis_manager = RedisManager(get_settings().REDIS_URL)
