from contextlib import asynccontextmanager
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from app.rag.retriever import search_similar_chunks


class SearchSimilarChunksTests(IsolatedAsyncioTestCase):
    async def test_returns_reciprocal_rank_fusion_without_model_reranking(self):
        dense_chunks = [{"id": "a"}, {"id": "b"}]
        lexical_chunks = [{"id": "b"}, {"id": "c"}]

        @asynccontextmanager
        async def fake_get_db():
            yield object()

        with (
            patch("app.rag.retriever.get_db", fake_get_db),
            patch(
                "app.rag.retriever._dense_vector_search",
                new=AsyncMock(return_value=dense_chunks),
            ),
            patch(
                "app.rag.retriever._fetch_lexical_candidates",
                new=AsyncMock(return_value=lexical_chunks),
            ),
            patch(
                "app.rag.retriever._rank_bm25",
                return_value=lexical_chunks,
            ),
        ):
            chunks = await search_similar_chunks(
                query_embedding=[0.0] * 1536,
                repository_id="repo",
                commit_sha="commit",
                limit=2,
                query_text="find bug",
            )

        self.assertEqual([chunk["id"] for chunk in chunks], ["b", "a"])
