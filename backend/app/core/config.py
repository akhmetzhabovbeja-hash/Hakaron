from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hakaron API"
    VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hakaron:hakaron_secret@postgres:5432/hakaron"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Auth
    SECRET_KEY: str = "dev-secret-key-not-for-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ML Service
    ML_SERVICE_URL: str = "http://ml-service:8001"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # HH.ru
    HH_API_BASE_URL: str = "https://api.hh.ru"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
