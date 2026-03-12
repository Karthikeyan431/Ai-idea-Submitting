from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "ai_idea_platform"
    SECRET_KEY: str = "dev-secret-key-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50
    SIMILARITY_THRESHOLD: float = 0.80
    SUPER_ADMIN_EMAIL: str = "superadmin@aiplatform.com"
    SUPER_ADMIN_PASSWORD: str = "SuperAdmin@123"
    SUPER_ADMIN_NAME: str = "Super Admin"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
