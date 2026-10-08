from typing import AsyncGenerator
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.orm import declarative_base


class DatabaseSettings(BaseSettings):
    """Database configuration supporting Supabase PostgreSQL and local testing."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    database_url: str = "sqlite+aiosqlite:///:memory:"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


db_settings = DatabaseSettings()
engine: AsyncEngine = create_async_engine(
    db_settings.async_database_url,
    echo=False,
    future=True,
)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency / generator for acquiring database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


_db_initialized = False


async def init_db(custom_engine: AsyncEngine = None) -> None:
    """Initializes tables in database idempotently."""
    global _db_initialized
    if _db_initialized and custom_engine is None:
        return
    target_engine = custom_engine or engine
    async with target_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if custom_engine is None:
        _db_initialized = True
