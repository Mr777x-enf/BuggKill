import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from pgvector.asyncpg import register_vector

from app.llm.db.connection import set_db_pool
from app.routes.router import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5433")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        min_size=1,
        max_size=10,
        init=register_vector,
    )
    app.state.pool = pool
    set_db_pool(pool)

    try:
        yield
    finally:
        try:
            await pool.close()
        finally:
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