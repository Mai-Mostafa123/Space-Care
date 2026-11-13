"""
Local AI Astronaut Assistant — Ollama + ChromaDB + Local Embeddings RAG Pipeline
Zero external AI cloud API dependency.
"""

import json
import math
import re
from typing import Any
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import (
    AnomalyAlert,
    AssistantConversation,
    Astronaut,
    EnvironmentalRecord,
    HealthRecord,
    ResearchDocument,
)


def check_ollama_status() -> dict[str, Any]:
    try:
        with httpx.Client(timeout=2.5) as client:
            resp = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                return {
                    "connected": True,
                    "base_url": settings.OLLAMA_BASE_URL,
                    "available_models": models,
                    "preferred_model": settings.OLLAMA_CHAT_MODEL,
                    "embed_model": settings.OLLAMA_EMBED_MODEL,
                }
    except Exception as exc:
        return {
            "connected": False,
            "base_url": settings.OLLAMA_BASE_URL,
            "available_models": [],
            "preferred_model": settings.OLLAMA_CHAT_MODEL,
            "embed_model": settings.OLLAMA_EMBED_MODEL,
            "error": str(exc),
            "how_to_start": "Run 'ollama serve' and pull 'ollama pull qwen2.5:3b' + 'ollama pull nomic-embed-text'.",
        }
    return {"connected": False, "base_url": settings.OLLAMA_BASE_URL, "available_models": []}


def _get_chroma_collection():
    import chromadb  # Lazy load to keep startup memory minimal on 8 GB RAM systems

    client = chromadb.PersistentClient(path=str(settings.CHROMA_DB_DIR))
    return client.get_or_create_collection(name="nasa_spaceflight_research")


def _ollama_embed(texts: list[str]) -> list[list[float]] | None:
    try:
        embeddings = []
        with httpx.Client(timeout=15.0) as client:
            for text in texts:
                r = client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/embeddings",
                    json={"model": settings.OLLAMA_EMBED_MODEL, "prompt": text},
                )
                if r.status_code != 200:
                    return None
                embeddings.append(r.json()["embedding"])
        return embeddings
    except Exception:
        return None


def index_research_corpus_to_chromadb(db: Session) -> dict[str, Any]:
    docs = db.query(ResearchDocument).all()
    if not docs:
        return {"indexed_chunks": 0, "backend": "none"}

    chunk_ids, chunk_texts, chunk_metas = [], [], []
    for doc in docs:
        chunks = json.loads(doc.content_chunks_json)
        for i, chunk in enumerate(chunks):
            chunk_ids.append(f"{doc.doc_id}_c{i}")
            chunk_texts.append(chunk)
            chunk_metas.append(
                {
                    "doc_id": doc.doc_id,
                    "title": doc.title,
                    "source_org": doc.source_org,
                    "url": doc.url,
                    "hazard_category": doc.hazard_category,
                    "verified_reference": doc.verified_reference,
                }
            )

    embeddings = _ollama_embed(chunk_texts)
    try:
        collection = _get_chroma_collection()
        if embeddings:
            collection.upsert(ids=chunk_ids, documents=chunk_texts, metadatas=chunk_metas, embeddings=embeddings)
            return {"indexed_chunks": len(chunk_ids), "backend": "ChromaDB + Ollama nomic-embed-text"}
        collection.upsert(ids=chunk_ids, documents=chunk_texts, metadatas=chunk_metas)
        return {"indexed_chunks": len(chunk_ids), "backend": "ChromaDB Default Local Embeddings"}
    except Exception as exc:
        return {"indexed_chunks": 0, "backend": "Keyword/TF-IDF Fallback", "error": str(exc)}


_RAG_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
    "how", "what", "why", "does", "into", "about", "have", "has", "can", "will",
    "many", "much", "when", "where", "which", "who", "did", "nasa", "astronaut",
    "astronauts", "space", "spaceflight", "mission", "missions",
}


def _lexical_retrieve(db: Session, query: str, top_k: int = 3) -> list[dict[str, Any]]:
    terms = {t for t in re.findall(r"[a-z0-9]{3,}", query.lower()) if t not in _RAG_STOPWORDS}
    if not terms:
        return []
    docs = db.query(ResearchDocument).all()
    scored = []
    min_required = 2 if len(terms) >= 4 else 1
    for doc in docs:
        chunks = json.loads(doc.content_chunks_json)
        for chunk in chunks:
            c_terms = [
                t
                for t in re.findall(r"[a-z0-9]{3,}", (doc.title + " " + doc.hazard_category + " " + chunk).lower())
                if t not in _RAG_STOPWORDS
            ]
            overlap = sum(1 for t in terms if t in c_terms)
            score = overlap / math.sqrt(len(c_terms) + 1)
            if overlap >= min_required:
                scored.append(
                    {
                        "score": score,
                        "doc_id": doc.doc_id,
                        "title": doc.title,
                        "source_org": doc.source_org,
                        "url": doc.url,
                        "hazard_category": doc.hazard_category,
                        "verified_reference": doc.verified_reference,
                        "excerpt": chunk,
                    }
                )
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def retrieve_nasa_research(db: Session, query: str, top_k: int = 3) -> list[dict[str, Any]]:
    try:
        collection = _get_chroma_collection()
        if collection.count() == 0:
            index_research_corpus_to_chromadb(db)
        q_emb = _ollama_embed([query])
        if q_emb:
            res = collection.query(query_embeddings=q_emb, n_results=top_k)
        else:
            res = collection.query(query_texts=[query], n_results=top_k)

        hits = []
        for idx in range(len(res["documents"][0])):
            meta = res["metadatas"][0][idx]
            hits.append(
                {
                    "doc_id": meta["doc_id"],
                    "title": meta["title"],
                    "source_org": meta["source_org"],
                    "url": meta["url"],
                    "hazard_category": meta["hazard_category"],
                    "verified_reference": meta["verified_reference"],
                    "excerpt": res["documents"][0][idx],
                }
            )
        if hits:
            return hits
    except Exception:
        pass
    return _lexical_retrieve(db, query, top_k=top_k)


def _assemble_personal_context(db: Session, astronaut_id: int | None) -> tuple[str, list[dict[str, Any]]]:
    context_items = []
    if astronaut_id:
        astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
        if astro:
            latest = (
                db.query(HealthRecord)
                .filter(HealthRecord.astronaut_id == astro.id)
                .order_by(HealthRecord.recorded_at.desc())
                .limit(5)
                .all()
            )
            alerts = (
                db.query(AnomalyAlert)
                .filter(AnomalyAlert.astronaut_id == astro.id, AnomalyAlert.status == "ACTIVE")
                .order_by(AnomalyAlert.detected_at.desc())
                .limit(3)
                .all()
            )
            context_items.append(
                {
                    "type": "astronaut_profile",
                    "call_sign": astro.call_sign,
                    "role": astro.role,
                    "data_source": astro.data_source,
                    "latest_records": len(latest),
                    "active_alerts": len(alerts),
                }
            )
            summary_lines = [
                f"Astronaut {astro.call_sign} ({astro.full_name}, {astro.role}, Data Source: {astro.data_source}, Mission Day {astro.mission_day}/{astro.mission_duration_days})."
            ]
            for r in latest:
                summary_lines.append(
                    f"  - {r.recorded_at[:10]} [{r.data_source}]: HR={r.heart_rate_bpm} bpm, SpO2={r.spo2_pct}%, Sleep={r.sleep_duration_hrs}h, Stress={r.stress_score}/10, Mood={r.mood_score}/10"
                )
            for a in alerts:
                summary_lines.append(f"  - ACTIVE ALERT ({a.severity_tier}): {a.explanation}")
            return "\n".join(summary_lines), context_items

    env = db.query(EnvironmentalRecord).order_by(EnvironmentalRecord.recorded_at.desc()).first()
    if env:
        context_items.append({"type": "habitat_environment", "data_source": env.data_source})
        return (
            f"Latest Habitat Environment ({env.recorded_at[:10]}, {env.data_source}): "
            f"Radiation={env.radiation_msv_day} mSv/day, CO2={env.cabin_co2_ppm} ppm, "
            f"O2={env.oxygen_pct}%, Temp={env.temperature_c} C, Humidity={env.humidity_pct}%.",
            context_items,
        )
    return "No personal records selected.", context_items


def query_local_assistant(
    db: Session,
    question: str,
    astronaut_id: int | None = None,
    session_id: str = "default-local-session",
    model_name: str | None = None,
) -> dict[str, Any]:
    research_hits = retrieve_nasa_research(db, question, top_k=3)
    personal_summary, context_records = _assemble_personal_context(db, astronaut_id)
    ollama_info = check_ollama_status()
    target_model = model_name or settings.OLLAMA_CHAT_MODEL

    unmonitored_patterns = [
        (r"\bblood\s*pressure\b|\bsystolic\b|\bdiastolic\b", "blood pressure"),
        (r"\becg\b|\bekg\b|\belectrocardiogram\b", "ECG/EKG waveform"),
        (r"\bglucose\b|\binsulin\b|\bblood\s*sugar\b", "blood glucose"),
        (r"\bbone\s*density\b|\bdxa\b", "DXA bone mineral density"),
        (r"\bmri\b|\bx-?ray\b|\bct\s*scan\b", "medical imaging (MRI/X-ray/CT)"),
    ]
    unmonitored = [label for rx, label in unmonitored_patterns if re.search(rx, question, re.I)]
    missing_notice = (
        f"Unavailable Telemetry Notice: {', '.join(unmonitored)} not collected in local SQLite telemetry. "
        "Available physiological metrics are Heart Rate, SpO2, Sleep Duration/Stages, Physical Activity, Stress, and Mood.\n\n"
        if unmonitored
        else ""
    )

    citations_block = "\n".join(
        f"[{i+1}] {h['title']} ({h['source_org']} | {h['doc_id']}): {h['excerpt']}"
        for i, h in enumerate(research_hits)
    ) or "No matching verified NASA documents found in local corpus."

    system_prompt = (
        "You are an offline NASA-grounded astronaut medical decision-support assistant. "
        "NEVER diagnose diseases, prescribe medications, or invent citations. "
        "If reliable information or requested telemetry is unavailable, explicitly say you do not know. "
        "Always distinguish SYNTHETIC, MANUAL, and REAL data sources, cite retrieved NASA documents "
        "explicitly by their doc_id, and state missing information or uncertainty clearly."
    )
    user_prompt = (
        f"{missing_notice}"
        f"PERSONAL & HABITAT CONTEXT:\n{personal_summary}\n\n"
        f"RETRIEVED VERIFIED NASA DOCUMENTS:\n{citations_block}\n\n"
        f"USER QUESTION: {question}"
    )

    uncertainty_note = (
        "Decision-support only: Do not treat AI summaries as clinical diagnosis. "
        "Verify personal baseline alerts against raw telemetry."
    )
    engine_used = "Ollama Unavailable (Grounded Retrieval Preview)"
    answer_text = ""

    if ollama_info.get("connected"):
        try:
            with httpx.Client(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                resp = client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": target_model,
                        "stream": False,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                )
                if resp.status_code == 200:
                    answer_text = resp.json().get("message", {}).get("content", "").strip()
                    engine_used = f"Ollama Local ({target_model})"
        except Exception as exc:
            uncertainty_note = f"Ollama request failed ({exc}); returning grounded local retrieval excerpts."

    if not answer_text:
        if not research_hits and astronaut_id is None:
            answer_text = (
                f"{missing_notice}"
                "Insufficient reliable information found in the local NASA research corpus to answer this question accurately. "
                "No citations or external claims were fabricated."
            )
        else:
            top_excerpts = "\n\n".join(
                f"- **{h['title']} (`{h['doc_id']}`)**: {h['excerpt']}" for h in research_hits
            )
            answer_text = (
                f"{missing_notice}"
                f"Local Ollama inference at `{settings.OLLAMA_BASE_URL}` is currently offline or model "
                f"`{target_model}` is not loaded. Below is the grounded context retrieved locally from SQLite and "
                f"the verified NASA research corpus:\n\n"
                f"**Telemetry Context:**\n{personal_summary}\n\n"
                f"**Verified NASA Research References:**\n{top_excerpts or 'No matching research excerpts found for this query.'}"
            )

    db.add(
        AssistantConversation(
            session_id=session_id,
            astronaut_id=astronaut_id,
            role="user",
            message_text=question,
            inference_engine=engine_used,
        )
    )
    db.add(
        AssistantConversation(
            session_id=session_id,
            astronaut_id=astronaut_id,
            role="assistant",
            message_text=answer_text,
            citations_json=json.dumps(research_hits),
            context_records_json=json.dumps(context_records),
            inference_engine=engine_used,
            uncertainty_note=uncertainty_note,
        )
    )
    db.commit()

    return {
        "answer": answer_text,
        "citations": research_hits,
        "context_records": context_records,
        "inference_engine": engine_used,
        "ollama_connected": ollama_info.get("connected", False),
        "uncertainty_note": uncertainty_note,
    }
