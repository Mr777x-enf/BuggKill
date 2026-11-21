
import asyncio
import logging
import math
import os
import re
from threading import Lock
from typing import Any

from rank_bm25 import BM25Okapi
from langsmith import traceable

from app.llm.db.connection import get_db


logger = logging.getLogger(__name__)

_RRF_K = 60
_TOKEN_PATTERN = re.compile(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)|\d+")
_DEFAULT_CROSS_ENCODER = "cross-encoder/ms-marco-MiniLM-L-6-v2"

_cross_encoder: Any | None = None
_cross_encoder_lock = Lock()


def _tokenize(text: str) -> list[str]:
    return [token.lower() for token in _TOKEN_PATTERN.findall(text)]


@traceable(name="bm25_keyword_ranking", run_type="chain")
def _rank_bm25(
    query: str,
    chunks: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:

    query_tokens = _tokenize(query)

    if not query_tokens or not chunks:
        return []

    documents = [
        _tokenize(
            " ".join(
                (
                    chunk.get("file_path") or "",
                    chunk.get("symbol_name") or "",
                    chunk.get("source") or "",
                )
            )
        )
        for chunk in chunks
    ]

    if not any(documents):
        return []

    scores = BM25Okapi(documents).get_scores(query_tokens)

    ranked_indices = sorted(
        (
            index
            for index, document in enumerate(documents)
            if any(token in document for token in query_tokens)
        ),
        key=lambda index: (-scores[index], index),
    )[:limit]

    return [chunks[index] for index in ranked_indices]


@traceable(name="reciprocal_rank_fusion", run_type="chain")
def _fuse_rankings(
    dense_chunks: list[dict[str, Any]],
    lexical_chunks: list[dict[str, Any]],
) -> list[dict[str, Any]]:

    scores: dict[str, float] = {}
    chunks_by_id: dict[str, dict[str, Any]] = {}

    for ranking in (dense_chunks, lexical_chunks):
        for rank, chunk in enumerate(ranking, start=1):
            chunk_id = chunk["id"]

            chunks_by_id.setdefault(chunk_id, chunk)

            scores[chunk_id] = scores.get(chunk_id, 0.0) + (
                1.0 / (_RRF_K + rank)
            )

    ranked_ids = sorted(
        scores,
        key=lambda chunk_id: scores[chunk_id],
        reverse=True,
    )

    return [chunks_by_id[chunk_id] for chunk_id in ranked_ids]


@traceable(name="initialize_cross_encoder", run_type="chain")
def _get_cross_encoder() -> Any:
    global _cross_encoder

    if _cross_encoder is None:
        with _cross_encoder_lock:
            if _cross_encoder is None:
                try:
                    from sentence_transformers import CrossEncoder

                    model_name = os.getenv(
                        "CROSS_ENCODER_MODEL",
                        _DEFAULT_CROSS_ENCODER,
                    )

                    _cross_encoder = CrossEncoder(
                        model_name,
                        device="cpu",
                    )

                except Exception as exc:
                    logger.exception(
                        "Failed to initialize CrossEncoder model"
                    )
                    raise RuntimeError(
                        "CrossEncoder model initialization failed"
                    ) from exc

    return _cross_encoder


@traceable(name="cross_encoder_reranking", run_type="chain")
def _rerank_with_cross_encoder(
    query: str,
    chunks: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:

    if not chunks or not query.strip():
        return chunks[:limit]

    pairs = [
        (
            query,
            " ".join(
                (
                    chunk.get("file_path") or "",
                    chunk.get("symbol_name") or "",
                    chunk.get("source") or "",
                )
            ),
        )
        for chunk in chunks
    ]

    try:
        scores = _get_cross_encoder().predict(
            pairs,
            batch_size=32,
            show_progress_bar=False,
        )

        if len(scores) != len(chunks):
            raise ValueError(
                f"Expected {len(chunks)} CrossEncoder scores, got {len(scores)}"
            )

        numeric_scores = [float(score) for score in scores]

        if not all(math.isfinite(score) for score in numeric_scores):
            raise ValueError(
                "CrossEncoder returned a non-finite score"
            )

        ranked = sorted(
            zip(numeric_scores, chunks),
            key=lambda item: item[0],
            reverse=True,
        )

    except Exception as exc:
        logger.exception("CrossEncoder inference failed")
        raise RuntimeError(
            "CrossEncoder reranking failed"
        ) from exc

    return [chunk for _score, chunk in ranked[:limit]]


@traceable(
    name="dense_vector_search",
    run_type="retriever",
)
async def _dense_vector_search(
    db: Any,
    query_embedding: list[float],
    repository_id: str,
    commit_sha: str,
    candidate_limit: int,
):
    return await db.fetch(
        """
        SELECT
            id,
            repository_id,
            commit_sha,
            session_id,
            file_path,
            language,
            symbol_name,
            symbol_type,
            parent_symbol,
            start_line,
            end_line,
            source,
            parser_version,
            chunker_version,
            embedding <=> $1 AS distance
        FROM code_chunks
        WHERE repository_id = $2
          AND commit_sha = $3
        ORDER BY embedding <=> $1
        LIMIT $4
        """,
        query_embedding,
        repository_id,
        commit_sha,
        candidate_limit,
    )


@traceable(
    name="fetch_lexical_candidates",
    run_type="retriever",
)
async def _fetch_lexical_candidates(
    db: Any,
    repository_id: str,
    commit_sha: str,
):
    return await db.fetch(
        """
        SELECT
            id,
            repository_id,
            commit_sha,
            session_id,
            file_path,
            language,
            symbol_name,
            symbol_type,
            parent_symbol,
            start_line,
            end_line,
            source,
            parser_version,
            chunker_version
        FROM code_chunks
        WHERE repository_id = $1
          AND commit_sha = $2
        """,
        repository_id,
        commit_sha,
    )


@traceable(
    name="hybrid_code_search",
    run_type="chain",
)
async def search_similar_chunks(
    query_embedding: list[float],
    repository_id: str,
    commit_sha: str,
    limit: int = 5,
    query_text: str = "",
) -> list[dict[str, Any]]:
    """
    Retrieve hybrid vector/BM25 candidates and rerank them with a CrossEncoder.
    """

    if not query_embedding:
        return []

    if limit <= 0:
        raise ValueError("limit must be greater than 0")

    if len(query_embedding) != 1536:
        raise ValueError(
            f"Expected 1536-dimensional embedding, got {len(query_embedding)}"
        )

    candidate_limit = max(limit * 4, 20)

    # 1. Fetch candidates from PostgreSQL
    async with get_db() as db:

        # Sequential execution: asyncpg connections cannot execute
        # multiple queries simultaneously on the same connection.
        dense_rows = await _dense_vector_search(
            db,
            query_embedding,
            repository_id,
            commit_sha,
            candidate_limit,
        )

        lexical_rows = await _fetch_lexical_candidates(
            db,
            repository_id,
            commit_sha,
        )

    dense_chunks = [dict(row) for row in dense_rows]
    lexical_chunks = [dict(row) for row in lexical_rows]

    # 2. BM25 keyword ranking
    bm25_chunks = _rank_bm25(
        query_text,
        lexical_chunks,
        candidate_limit,
    )

    # 3. Reciprocal Rank Fusion
    candidates = _fuse_rankings(
        dense_chunks,
        bm25_chunks,
    )

    # 4. CrossEncoder reranking
    return await asyncio.to_thread(
        _rerank_with_cross_encoder,
        query_text,
        candidates,
        limit,
    )

