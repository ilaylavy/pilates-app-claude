import secrets
import os
import sys
from typing import List, Optional, Union
from functools import cached_property

from pydantic import field_validator, ValidationError
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database - NO defaults for production safety
    DATABASE_URL: str
    
    # Redis - NO defaults for production safety  
    REDIS_URL: str

    # Security - Generate secure defaults but require override in production
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 5

    # Email verification
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 10

    # Password reset
    PASSWORD_RESET_EXPIRE_HOURS: int = 1

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: str = ""
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Pilates Booking System"

    # Business rules
    MAX_BOOKINGS_PER_WEEK: int = 10
    CANCELLATION_HOURS_LIMIT: int = 2
    WAITLIST_AUTO_PROMOTION: bool = True

    # Timezone
    DEFAULT_TIMEZONE: str = "Asia/Jerusalem"

    # Database connection pool settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Stripe Configuration - Required, no defaults
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CURRENCY: str = "ils"  # Israeli Shekel
    STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID: str = ""


    @cached_property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        elif isinstance(self.CORS_ORIGINS, str) and self.CORS_ORIGINS:
            return [i.strip() for i in self.CORS_ORIGINS.split(",") if i.strip()]
        else:
            # Default CORS origins based on environment
            if self.ENVIRONMENT == "development":
                return [
                    "http://localhost:3000",
                    "http://localhost:19006", 
                    "http://10.100.102.24:19006",
                    "http://10.0.2.2:8000"
                ]
            else:
                return []

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v, info):
        env = os.getenv("ENVIRONMENT", "development")
        if not v:
            if env == "production":
                raise ValueError("SECRET_KEY is required in production")
            # Generate a secure random key for development
            return secrets.token_urlsafe(64)
        
        if env == "production" and (len(v) < 32 or v in ["default-secret-key-change-in-production", "your-secret-key-change-in-production"]):
            raise ValueError("SECRET_KEY must be at least 32 characters long and secure in production")
        
        return v
    
    @field_validator("STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID")
    @classmethod
    def validate_stripe_keys(cls, v, info):
        field_name = info.field_name
        env = os.getenv("ENVIRONMENT", "development")
        
        if not v and env == "production":
            raise ValueError(f"{field_name} is required in production")
        
        if v and "your_" in v.lower():
            if env == "production":
                raise ValueError(f"{field_name} contains placeholder value in production")
                
        return v

    def validate_environment_config(self):
        """Validate configuration after initialization"""
        required_in_production = {
            "DATABASE_URL": self.DATABASE_URL,
            "REDIS_URL": self.REDIS_URL,
            "SECRET_KEY": self.SECRET_KEY,
        }
        
        if self.ENVIRONMENT == "production":
            for key, value in required_in_production.items():
                if not value:
                    raise ValueError(f"{key} is required in production environment")
                    
            # Additional production validations
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
                
            if "*" in str(self.CORS_ORIGINS):
                raise ValueError("CORS_ORIGINS cannot contain '*' in production")

    model_config = {"case_sensitive": True, "env_file": ".env", "extra": "ignore"}


# Initialize settings and validate
try:
    settings = Settings()
    settings.validate_environment_config()
except ValidationError as e:
    print(f"[ERROR] Configuration validation failed: {e}")
    if os.getenv("ENVIRONMENT") == "production":
        sys.exit(1)
    else:
        print("[WARNING] Continuing with development defaults...")
        settings = Settings()
except Exception as e:
    print(f"[ERROR] Configuration initialization failed: {e}")
    sys.exit(1)
