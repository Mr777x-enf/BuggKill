from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.chat import process_chat


router = APIRouter()


class ConversationMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    question: str
    repository_id: str
    commit_sha: str
    conversation_history: list[ConversationMessage] = Field(default_factory=list)


@router.post("/")
async def chat(request: ChatRequest):
    result = await process_chat(
        session_id=request.session_id,
        question=request.question,
        repository_id=request.repository_id,
        commit_sha=request.commit_sha,
        conversation_history=[
            {"role": message.role, "content": message.content}
            for message in request.conversation_history
        ],
    )

    return result