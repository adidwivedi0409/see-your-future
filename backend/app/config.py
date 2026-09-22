"""Environment configuration (plain os.getenv, no pydantic-settings)."""
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass


def _bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.DEMO_MODE: bool = _bool(os.getenv("DEMO_MODE"), True)
        self.COGNEE_API_KEY: str | None = os.getenv("COGNEE_API_KEY") or None
        self.COGNEE_BASE_URL: str | None = os.getenv("COGNEE_BASE_URL") or None
        self.BRIGHT_DATA_API_KEY: str | None = os.getenv("BRIGHT_DATA_API_KEY") or None
        self.BRIGHT_DATA_DATASET_ID: str | None = os.getenv("BRIGHT_DATA_DATASET_ID") or None
        self.AWS_REGION: str | None = os.getenv("AWS_REGION") or None
        self.AWS_ACCESS_KEY_ID: str | None = os.getenv("AWS_ACCESS_KEY_ID") or None
        self.AWS_SECRET_ACCESS_KEY: str | None = os.getenv("AWS_SECRET_ACCESS_KEY") or None
        self.STRANDS_MODEL_ID: str | None = os.getenv("STRANDS_MODEL_ID") or None
        self.ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY") or None
        try:
            self.UPLOAD_MAX_MB: int = int(os.getenv("UPLOAD_MAX_MB", "5"))
        except ValueError:
            self.UPLOAD_MAX_MB = 5
        self.VERSION: str = "0.1.0"


settings = Settings()
