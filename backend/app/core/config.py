from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Aegis Orbital Health API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "local"

    # Storage paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR.parent / "data"
    SQLITE_DB_PATH: Path = DATA_DIR / "processed" / "aegis_orbital.db"
    CHROMA_DB_DIR: Path = DATA_DIR / "processed" / "chroma_db"
    ML_MODELS_DIR: Path = DATA_DIR / "processed" / "ml_models"

    # Local Ollama Configuration (no cloud API keys required)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "qwen2.5:3b"
    OLLAMA_FALLBACK_MODEL: str = "llama3.2:3b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    OLLAMA_TIMEOUT_SECONDS: float = 45.0

    # Local Voice Configuration (faster-whisper tiny or base for low-RAM Windows 11 CPU)
    WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
settings.SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
settings.CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
settings.ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)
