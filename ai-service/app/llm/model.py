import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors

load_dotenv(
    dotenv_path=Path(__file__).resolve().parents[2] / ".env"
)

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


async def ask_llm(
    question: str,
    context: str,
    conversation_history: list[dict[str, str]] | None = None,
) -> str:
    """
    Send the user's question and retrieved code context
    to Gemini and return the answer.
    """

    if not question.strip():
        raise ValueError("Question cannot be empty")

    history_lines = []
    for message in (conversation_history or [])[-20:]:
        role = message.get("role", "")
        content = message.get("content", "")
        if role in ("user", "assistant") and content:
            speaker = "User" if role == "user" else "Assistant"
            history_lines.append(f"{speaker}: {content}")

    conversation_context = "\n".join(history_lines)
    prompt = f"""
You are BugDady, an AI code debugging assistant.

Analyze the provided repository context and answer
the user's question using the code as evidence.

If the context does not contain enough information,
say so instead of inventing code or facts.

Repository context:

{context}

Previous conversation:

{conversation_context or "No previous messages."}

Current user question:

{question}

Use the previous conversation when it adds necessary context. Do not repeat earlier answers unless needed.
"""

    primary_model = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.8-flash")
    fallback_models = ["gemini-2.5-flash", "gemini-3.6-flash"]

    for model in dict.fromkeys([primary_model, *fallback_models]):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
            )
            return response.text
        except errors.APIError as error:
            if getattr(error, "code", None) not in (404, 503, 429):
                raise
            continue

    raise RuntimeError("All configured Gemini chat models are unavailable")