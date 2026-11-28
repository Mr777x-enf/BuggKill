
import os
import time
import random
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.rag.models import CodeChunk


load_dotenv(
    dotenv_path=Path(__file__).resolve().parents[2] / ".env"
)


EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 1536
DEFAULT_BATCH_SIZE = 100
MAX_RETRIES = 5


client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def _embed_with_retry(
    texts: list[str],
    task_type: str,
) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in one API request.
    Retries temporary rate-limit errors.
    """

    for attempt in range(MAX_RETRIES):

        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIMENSION,
                    task_type=task_type,
                ),
            )

            embeddings_data = response.embeddings

            if len(embeddings_data) != len(texts):
                raise ValueError(
                    f"Expected {len(texts)} embeddings, "
                    f"got {len(embeddings_data)}"
                )

            embeddings = []

            for embedding_data in embeddings_data:

                embedding = embedding_data.values

                if len(embedding) != EMBEDDING_DIMENSION:
                    raise ValueError(
                        f"Expected {EMBEDDING_DIMENSION} dimensions, "
                        f"got {len(embedding)}"
                    )

                embeddings.append(embedding)

            return embeddings

        except Exception as e:

            if "429" not in str(e):
                raise

            if attempt == MAX_RETRIES - 1:
                raise

            wait_time = (
                2 ** attempt * 5
                + random.uniform(0, 2)
            )

            print(
                f"Gemini rate limit reached. "
                f"Retrying in {wait_time:.2f} seconds."
            )

            time.sleep(wait_time)


def create_embedding(text: str) -> list[float]:
    """
    Create an embedding for a single user query.
    """

    if not text or not text.strip():
        raise ValueError(
            "Cannot create embedding for empty text"
        )

    embeddings = _embed_with_retry(
        [text],
        "RETRIEVAL_QUERY",
    )

    return embeddings[0]


def create_embeddings(
    chunks: list[CodeChunk],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[tuple[CodeChunk, list[float]]]:
    """
    Create embeddings for multiple CodeChunks.

    Each chunk retains its original metadata
    and is paired with its corresponding embedding.
    """

    if batch_size <= 0:
        raise ValueError(
            "batch_size must be greater than 0"
        )

    if not chunks:
        return []

    results: list[
        tuple[CodeChunk, list[float]]
    ] = []

    for start in range(
        0,
        len(chunks),
        batch_size,
    ):

        batch = chunks[
            start:start + batch_size
        ]

        texts = []

        for chunk in batch:

            if not chunk.source or not chunk.source.strip():
                raise ValueError(
                    f"Cannot create embedding for empty chunk: {chunk.id}"
                )

            texts.append(chunk.source)

        embeddings = _embed_with_retry(
            texts,
            "RETRIEVAL_DOCUMENT",
        )

        for chunk, embedding in zip(
            batch,
            embeddings,
        ):

            results.append(
                (chunk, embedding)
            )

        print(
            f"Embedded {len(results)}/{len(chunks)} chunks"
        )

    return results
