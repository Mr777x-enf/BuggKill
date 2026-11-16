import asyncio

from app.llm.db.connection import get_db
from app.main import app, lifespan


async def main():
    async with lifespan(app):
        async with get_db() as db:
            result = await db.fetchval("SELECT 1")
            print("Database connection successful:", result)


if __name__ == "__main__":
    asyncio.run(main())