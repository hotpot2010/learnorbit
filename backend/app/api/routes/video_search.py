"""
视频搜索API路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.bilibili_search_service import bilibili_search_service
from app.services.youtube_search_service import youtube_search_service
from app.services.video_analyzer_service import video_analyzer_service

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        import logging
        logging.info(msg)

router = APIRouter()


class VideoSearchRequest(BaseModel):
    """视频搜索请求"""
    query: str
    limit: int = 10  # 默认返回10个结果，最多10个
    locale: str = 'zh'  # 语言环境，默认为中文


class VideoSearchResponse(BaseModel):
    """视频搜索响应"""
    success: bool
    videos: List[Dict[str, Any]]
    total: int
    message: str = ""


@router.post("/search", response_model=VideoSearchResponse)
async def search_videos(request: VideoSearchRequest):
    """
    搜索视频并进行LLM分析
    
    流程：
    1. 根据locale选择搜索源（中文：B站，英文：YouTube）
    2. 对搜索结果进行重排序（优化推荐质量）
    3. 并行调用LLM分析每个视频
    4. 返回带有分析结果的视频列表
    """
    try:
        query = request.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="搜索关键词不能为空")
        
        limit = min(request.limit, 10)  # 最多返回10个结果
        locale = request.locale or 'zh'
        
        safe_print(f"\n🔍 收到搜索请求: {query} (limit={limit}, locale={locale})")
        
        # 1. 根据locale选择搜索源
        if locale == 'en':
            # 英文模式：搜索YouTube视频
            safe_print("🌐 使用YouTube搜索")
            videos = await youtube_search_service.search_videos_with_rerank(query, limit)
            if not videos:
                return VideoSearchResponse(
                    success=False,
                    videos=[],
                    total=0,
                    message="No related videos found, please try other keywords"
                )
        else:
            # 中文模式：搜索B站视频
            safe_print("🇨🇳 使用B站搜索")
            videos = await bilibili_search_service.search_videos_with_rerank(query, limit)
            if not videos:
                return VideoSearchResponse(
                    success=False,
                    videos=[],
                    total=0,
                    message="未找到相关视频，请尝试其他关键词"
                )
        
        # 2. 并行调用LLM分析视频（传递 locale）
        analyzed_videos = await video_analyzer_service.analyze_videos_batch(videos, locale=locale)
        
        # 调试：打印第一个视频的详细信息
        if analyzed_videos:
            first_video = analyzed_videos[0]
            safe_print(f"  第一个视频标题: {first_video.get('title', 'N/A')[:30]}")
            safe_print(f"  第一个视频封面URL: {first_video.get('cover', 'N/A')}")
            safe_print(f"  第一个视频is_series: {first_video.get('is_series', False)}")
            safe_print(f"  第一个视频video_amount: {first_video.get('video_amount', 1)}")
        
        # 3. 返回结果
        safe_print(f"✅ 搜索完成，返回 {len(analyzed_videos)} 个视频")
        
        return VideoSearchResponse(
            success=True,
            videos=analyzed_videos,
            total=len(analyzed_videos),
            message=f"找到 {len(analyzed_videos)} 个相关视频"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        safe_print(f"❌ 视频搜索失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"搜索失败: {str(e)}"
        )


@router.get("/test")
async def test_search():
    """测试接口"""
    return {
        "status": "ok",
        "message": "Video search API is running",
        "endpoints": [
            "POST /video-search/search - 搜索视频并分析"
        ]
    }

