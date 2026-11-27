from app.agent.graph import agent_graph
from typing import TypedDict


class ConversationMessage(TypedDict):
    role: str
    content: str


async def process_chat(
    session_id: str,
    question: str,
    repository_id: str,
    commit_sha: str,
    conversation_history: list[ConversationMessage] | None = None,
):
    initial_state = {
        "question": question,
        "repository_id": repository_id,
        "commit_sha": commit_sha,
        "query_embedding": [],
        "chunks": [],
        "context": "",
        "analysis": "",
        "conversation_history": conversation_history or [],
    }
    config = {
        "configurable": {
            "thread_id": session_id
        }
    }

    final_state = await agent_graph.ainvoke(initial_state,config=config,)

    return {
        "session_id": session_id,
        "answer": final_state["analysis"],
        "sources": [
            {
                "file_path": chunk["file_path"],
                "start_line": chunk["start_line"],
                "end_line": chunk["end_line"],
                "symbol_name": chunk["symbol_name"],
            }
            for chunk in final_state["chunks"]
        ],
    }