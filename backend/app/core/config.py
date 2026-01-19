"""
Application configuration settings
"""
import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    # 兼容 pydantic v1
    try:
        from pydantic.v1 import BaseSettings
    except ImportError:
        from pydantic import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    SECRET_KEY: str = "your-secret-key-change-in-production"
    GEMINI_API_KEY: Optional[str] = None
    
    # File Upload Configuration
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    UPLOAD_DIR: str = "uploads"
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # CORS Configuration
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ]
    
    # VOD (Tencent Cloud Video on Demand) Configuration
    VOD_SECRET_ID: Optional[str] = None
    VOD_SECRET_KEY: Optional[str] = None
    VOD_PLAY_KEY: Optional[str] = None
    VOD_LICENSE_URL: Optional[str] = None
    VOD_LICENSE_KEY: Optional[str] = None
    VOD_PROCEDURE: str = "LongVideoPreset"
    VOD_REGION: str = "ap-beijing"  # 默认北京
    VOD_SUB_APP_ID: int = 0
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = 'ignore'  # 忽略未定义的环境变量

# Global settings instance
settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
