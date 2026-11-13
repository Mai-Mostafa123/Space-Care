import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.anomalies import router as anomalies_router
from app.api.assistant_voice import assistant_router, voice_router
from app.api.astronauts import router as astronauts_router
from app.api.system_reports import datasets_router, reports_router, system_router
from app.api.telemetry import env_router, health_router
from app.core.config import settings
from app.database.session import Base, SessionLocal, engine
from app.models.models import Astronaut
from app.services.seed_service import seed_initial_data
from ml.anomaly_detector import run_anomaly_detection_for_astronaut

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("aegis-orbital-health")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seeded = seed_initial_data(db)
        if seeded.get("astronauts", 0) > 0:
            for astro in db.query(Astronaut).all():
                run_anomaly_detection_for_astronaut(db, astro.id, persist_alerts=True)
        logger.info("SQLite database ready. Seed summary: %s", seeded)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Offline-first astronaut physiological monitoring, personal baseline ML anomaly detection, and local Ollama RAG decision-support API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled API error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "type": type(exc).__name__})


app.include_router(astronauts_router)
app.include_router(health_router)
app.include_router(env_router)
app.include_router(anomalies_router)
app.include_router(assistant_router)
app.include_router(voice_router)
app.include_router(reports_router)
app.include_router(datasets_router)
app.include_router(system_router)


@app.get("/")
def root():
    return {"service": settings.APP_NAME, "version": settings.APP_VERSION, "docs_url": "/docs"}
