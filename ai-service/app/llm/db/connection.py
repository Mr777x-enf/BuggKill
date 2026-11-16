from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

load_dotenv(
    dotenv_path=Path(__file__).resolve().parents[3] / ".env"
)


_pool: asyncpg.Pool | None = None


def set_db_pool(pool: asyncpg.Pool | None) -> None:
    global _pool
    _pool = pool


@asynccontextmanager
async def get_db() -> AsyncIterator[asyncpg.Connection]:
    pool = _pool
    if pool is None:
        raise RuntimeError("Database connection pool has not been initialized")

    async with pool.acquire() as db:
        yield db