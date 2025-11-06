"""
简化版FastAPI应用
避免复杂依赖，用于基础测试
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime

# 创建应用
app = FastAPI(
    title="Video Analysis API (Simple)",
    description="简化版视频分析API，用于测试基础功能",
    version="1.0.0-simple"
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """根端点"""
    return {
        "message": "Video Analysis API - Simple Version",
        "version": "1.0.0-simple",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/api/v1/video/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "message": "Simple version running",
        "timestamp": datetime.now().isoformat(),
        "note": "This is a simplified version without Gemini AI integration"
    }

@app.get("/api/v1/video/analysis-types")
async def get_analysis_types():
    """获取分析类型"""
    return {
        "analysis_types": [
            {"value": "general", "label": "通用分析"},
            {"value": "educational", "label": "教育分析"},
            {"value": "summary", "label": "内容摘要"},
            {"value": "quiz", "label": "测试生成"}
        ],
        "descriptions": {
            "general": "全面分析视频内容（需要完整版本）",
            "educational": "教育价值分析（需要完整版本）",
            "summary": "内容摘要生成（需要完整版本）",
            "quiz": "测试题目生成（需要完整版本）"
        },
        "note": "这是简化版本，实际分析功能需要完整版本和Gemini API密钥"
    }

@app.post("/api/v1/video/upload-and-analyze")
async def upload_and_analyze_placeholder():
    """上传分析占位符"""
    raise HTTPException(
        status_code=501,
        detail="简化版本不支持视频分析。请使用完整版本 (python main.py) 并配置GEMINI_API_KEY"
    )

@app.post("/api/v1/video/analyze-by-path")
async def analyze_by_path_placeholder():
    """路径分析占位符"""
    raise HTTPException(
        status_code=501,
        detail="简化版本不支持视频分析。请使用完整版本 (python main.py) 并配置GEMINI_API_KEY"
    )

if __name__ == "__main__":
    print("🚀 启动简化版Video Analysis API...")
    print("📍 服务器地址: http://localhost:8000")
    print("📚 API文档: http://localhost:8000/docs")
    print("⚠️  注意: 这是简化版本，不包含AI分析功能")
    print("💡 要使用完整功能，请运行: python main.py")
    
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
