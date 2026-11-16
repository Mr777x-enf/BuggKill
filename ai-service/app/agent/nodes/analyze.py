from app.rag.context_builder import build_context
from app.llm.model import ask_llm


async def analyze_code(state: dict) -> dict:
    """
    Build context from retrieved code chunks
    and ask the LLM to analyze the user's question.
    """

    chunks = state["chunks"]
    question = state["question"]

    context = build_context(chunks)

    analysis = await ask_llm(
        question=question,
        context=context,
        conversation_history=state.get("conversation_history", []),
    )

    return {
        "context": context,
        "analysis": analysis,
    }