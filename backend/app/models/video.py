"""
Video analysis data models
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

class AnalysisType(str, Enum):
    """Video analysis types"""
    GENERAL = "general"
    EDUCATIONAL = "educational"
    SUMMARY = "summary"
    QUIZ = "quiz"
    CUSTOM = "custom"  # 用于自定义 Prompt

class VideoUploadRequest(BaseModel):
    """Video upload request model"""
    analysis_type: AnalysisType = AnalysisType.GENERAL
    custom_prompt: Optional[str] = None

class VideoAnalysisRequest(BaseModel):
    """Video analysis by path request model"""
    video_path: str
    analysis_type: AnalysisType = AnalysisType.GENERAL
    custom_prompt: Optional[str] = None

class VideoAnalysisResponse(BaseModel):
    """Video analysis response model"""
    success: bool
    analysis_type: AnalysisType
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

class AnalysisTypesResponse(BaseModel):
    """Available analysis types response"""
    analysis_types: List[Dict[str, str]]
    descriptions: Dict[str, str]

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str
    timestamp: str
