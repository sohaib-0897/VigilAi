"""VigilAI Database Session"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from vigilai_api.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)
