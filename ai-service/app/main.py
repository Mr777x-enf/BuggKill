import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from dotenv import load_dotenv
import asyncpg
from fastapi import FastAPI
from pgvector.asyncpg import register_vector

from app.llm.db.connection import set_db_pool
from app.routes.router import router

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Missing DATABASE_URL environment variable")

    hostname = urlparse(dsn).hostname or ""
    ssl = "require" if hostname.endswith(".render.com") else None

    pool = await asyncpg.create_pool(
        dsn=dsn,
        ssl=ssl,
        min_size=1,
        max_size=10,
        init=register_vector,
    )

    app.state.pool = pool
    set_db_pool(pool)

    try:
        yield
    finally:
        await pool.close()
        set_db_pool(None)
        app.state.pool = None

app = FastAPI(
    title="Code Debugger AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "AI service is running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }