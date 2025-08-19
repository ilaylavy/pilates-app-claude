from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings
import secrets


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://pilates_user:pilates_password@localhost:5432/pilates_db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:19006", 
        "http://10.100.102.24:19006",
        "http://10.0.2.2:8000",  # Android emulator
        "*"  # Allow all origins for development
    ]
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Pilates Booking System"
    
    # Business rules
    MAX_BOOKINGS_PER_WEEK: int = 10
    CANCELLATION_HOURS_LIMIT: int = 2
    WAITLIST_AUTO_PROMOTION: bool = True
    
    # Timezone
    DEFAULT_TIMEZONE: str = "Asia/Jerusalem"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:3000", "http://localhost:19006"]

    model_config = {"case_sensitive": True}


settings = Settings()