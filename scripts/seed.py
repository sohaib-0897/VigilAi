"""
VigilAI — Development Seed Script

Creates a development user for local testing.
This is DEVELOPMENT ONLY — do not use in production.

Usage:
    python scripts/seed.py
"""

import asyncio
import logging
import os
import sys

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)
# Also add the api package path
sys.path.insert(0, os.path.join(PROJECT_ROOT, "apps", "api"))

from vigilai_api.core.security import get_password_hash
from vigilai_api.db.session import async_session_maker
from vigilai_api.repositories.user import UserRepository

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Development credentials — clearly marked
DEV_EMAIL = "admin@vigilai.local"
DEV_USERNAME = "admin"
DEV_PASSWORD = "vigilai_dev_2024"


async def seed_dev_data() -> None:
    """Seed development data. Idempotent — safe to run multiple times."""
    logger.warning("=" * 50)
    logger.warning("  DEVELOPMENT ONLY — Seeding development data")
    logger.warning("=" * 50)

    async with async_session_maker() as session:
        user_repo = UserRepository(session)

        if await user_repo.exists(DEV_EMAIL):
            logger.info(f"User {DEV_EMAIL} already exists. Skipping.")
            return

        hashed_password = get_password_hash(DEV_PASSWORD)
        user = await user_repo.create(
            email=DEV_EMAIL,
            username=DEV_USERNAME,
            hashed_password=hashed_password,
        )
        await session.commit()

        logger.info("")
        logger.info("=" * 50)
        logger.info("  Development User Created")
        logger.info(f"  ID:       {user.id}")
        logger.info(f"  Email:    {DEV_EMAIL}")
        logger.info(f"  Username: {DEV_USERNAME}")
        logger.info(f"  Password: {DEV_PASSWORD}")
        logger.info("=" * 50)
        logger.info("")
        logger.info("  Use these credentials to log in at http://localhost:3000")
        logger.info("  DO NOT use these credentials in production!")
        logger.info("")


if __name__ == "__main__":
    asyncio.run(seed_dev_data())
