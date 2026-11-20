import asyncio

from app.rag.embeddings import create_embedding
from app.rag.retriever import search_similar_chunks


async def retrieve_code(state: dict) -> dict:
    question = state["question"]
    repository_id = state["repository_id"]
    commit_sha = state["commit_sha"]

    query_embedding = await asyncio.to_thread(create_embedding, question)

    chunks = await search_similar_chunks(
        query_embedding=query_embedding,
        query_text=question,
        repository_id=repository_id,
        commit_sha=commit_sha,
        limit=5,
    )

    return {
        "query_embedding": query_embedding,
        "chunks": chunks,
    }