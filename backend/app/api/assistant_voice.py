import json
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import AssistantConversation
from app.schemas.schemas import AssistantQueryRequest, VoiceExtractRequest
from rag.rag_pipeline import check_ollama_status, index_research_corpus_to_chromadb, query_local_assistant
from voice.voice_processor import extract_structured_from_transcript, transcribe_local_audio

assistant_router = APIRouter(prefix="/api/assistant", tags=["Local AI Assistant"])
voice_router = APIRouter(prefix="/api/voice", tags=["Local Voice"])


@assistant_router.get("/status")
def assistant_status():
    return check_ollama_status()


@assistant_router.post("/index")
def reindex_rag(db: Session = Depends(get_db)):
    return index_research_corpus_to_chromadb(db)


@assistant_router.get("/history")
def conversation_history(session_id: str = "default-local-session", db: Session = Depends(get_db)):
    rows = (
        db.query(AssistantConversation)
        .filter(AssistantConversation.session_id == session_id)
        .order_by(AssistantConversation.id.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "astronaut_id": r.astronaut_id,
            "role": r.role,
            "message_text": r.message_text,
            "citations": json.loads(r.citations_json or "[]"),
            "context_records": json.loads(r.context_records_json or "[]"),
            "inference_engine": r.inference_engine,
            "uncertainty_note": r.uncertainty_note,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@assistant_router.post("/query")
def ask_assistant(payload: AssistantQueryRequest, db: Session = Depends(get_db)):
    return query_local_assistant(
        db=db,
        question=payload.question,
        astronaut_id=payload.astronaut_id,
        session_id=payload.session_id,
        model_name=payload.model_name,
    )


@voice_router.post("/transcribe")
async def voice_transcribe(
    audio: UploadFile = File(...),
    target_mode: str = Form(default="health_log"),
    astronaut_id: Optional[int] = Form(default=None),
):
    content = await audio.read()
    stt = transcribe_local_audio(content, filename=audio.filename or "audio.webm")
    if not stt["success"]:
        return {**stt, "extracted": None}
    extracted = extract_structured_from_transcript(
        stt["transcript"], target_mode=target_mode, astronaut_id=astronaut_id
    )
    return {**stt, "extracted": extracted}


@voice_router.post("/extract")
def voice_extract(payload: VoiceExtractRequest):
    return extract_structured_from_transcript(
        transcript=payload.transcript,
        target_mode=payload.target_mode,
        astronaut_id=payload.astronaut_id,
    )
