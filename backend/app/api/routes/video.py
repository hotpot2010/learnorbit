"""
Video analysis API routes
"""
import os
import tempfile
import time
import asyncio
from datetime import datetime
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

from ...core.config import settings
from ...models.video import (
    VideoAnalysisRequest, 
    VideoAnalysisResponse, 
    AnalysisType,
    AnalysisTypesResponse,
    HealthResponse
)
from ...services.gemini_service import GeminiService
from ...utils.file_utils import validate_video_file, cleanup_temp_file

router = APIRouter(prefix="/api/v1/video", tags=["video"])

# Initialize Gemini service
try:
    gemini_service = GeminiService()
    GEMINI_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Gemini service initialization failed: {e}")
    GEMINI_AVAILABLE = False

@router.post("/upload-and-analyze", response_model=VideoAnalysisResponse)
async def upload_and_analyze_video(
    file: UploadFile = File(...),
    analysis_type: AnalysisType = Form(AnalysisType.GENERAL),
    custom_prompt: str = Form(None)
):
    """
    Upload a video file and analyze it using Gemini AI
    """
    if not GEMINI_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Gemini AI service is not available. Please check API key configuration."
        )
    
    temp_file_path = None
    
    try:
        # Validate file
        validate_video_file(file)
        
        # Save uploaded file temporarily
        temp_file_path = await _save_uploaded_file(file)
        
        # Analyze video with timeout (异步执行)
        print(f"🚀 开始分析视频: {file.filename}")
        
        # 使用线程池执行同步的Gemini调用，并设置超时
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            try:
                # 设置10分钟超时
                result = await asyncio.wait_for(
                    loop.run_in_executor(
                        executor,
                        gemini_service.analyze_video,
                        temp_file_path,
                        analysis_type,
                        custom_prompt
                    ),
                    timeout=600  # 10分钟超时
                )
                print(f"✅ 视频分析完成: {file.filename}")
                
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=408, 
                    detail="视频分析超时（10分钟），请尝试较短的视频文件"
                )
            except Exception as e:
                print(f"❌ 视频分析失败: {e}")
                raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
        
        return VideoAnalysisResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    finally:
        # Clean up temporary file
        if temp_file_path:
            cleanup_temp_file(temp_file_path)

@router.post("/analyze-by-path", response_model=VideoAnalysisResponse)
async def analyze_video_by_path(request: VideoAnalysisRequest):
    """
    Analyze a video file by its file path
    """
    if not GEMINI_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Gemini AI service is not available. Please check API key configuration."
        )
    
    try:
        # Check if file exists
        if not os.path.exists(request.video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Analyze video
        result = gemini_service.analyze_video(
            video_path=request.video_path,
            analysis_type=request.analysis_type,
            custom_prompt=request.custom_prompt
        )
        
        return VideoAnalysisResponse(**result)
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/analysis-types", response_model=AnalysisTypesResponse)
async def get_analysis_types():
    """
    Get available video analysis types
    """
    if not GEMINI_AVAILABLE:
        # Return basic info even if Gemini is not available
        return AnalysisTypesResponse(
            analysis_types=[
                {"value": "general", "label": "通用分析"},
                {"value": "educational", "label": "教育分析"},
                {"value": "summary", "label": "内容摘要"},
                {"value": "quiz", "label": "测试生成"}
            ],
            descriptions={
                "general": "全面分析视频内容（需要Gemini API）",
                "educational": "教育价值分析（需要Gemini API）",
                "summary": "内容摘要生成（需要Gemini API）",
                "quiz": "测试题目生成（需要Gemini API）"
            }
        )
    
    try:
        result = gemini_service.get_analysis_types()
        return AnalysisTypesResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analysis types: {str(e)}")

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    status = "healthy" if GEMINI_AVAILABLE else "degraded"
    message = "All services operational" if GEMINI_AVAILABLE else "Gemini AI service unavailable"
    
    return HealthResponse(
        status=status,
        message=message,
        timestamp=datetime.now().isoformat()
    )

async def _save_uploaded_file(file: UploadFile) -> str:
    """Save uploaded file to temporary location"""
    
    # Create temporary file with proper extension
    file_extension = os.path.splitext(file.filename or "")[1] or ".mp4"
    
    with tempfile.NamedTemporaryFile(
        delete=False, 
        suffix=file_extension,
        dir=settings.UPLOAD_DIR
    ) as temp_file:
        
        # Read and write file content
        content = await file.read()
        temp_file.write(content)
        temp_file_path = temp_file.name
    
    print(f"📁 Saved uploaded file: {temp_file_path}")
    return temp_file_path
