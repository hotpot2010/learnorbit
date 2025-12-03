"""
API routes for batch video analysis
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ...services.batch_analyzer import BatchAnalyzer
from ...services.bilibili_service import BilibiliService

router = APIRouter(prefix="/batch", tags=["batch-analysis"])

# Initialize services
batch_analyzer = BatchAnalyzer(
    use_cache=True,
    use_asr_doubao=True  # 使用 ASR + 豆包 + 文件上传服务
)
bilibili_service = BilibiliService()

# Store for SSE connections (in production, use Redis)
active_jobs: Dict[str, Dict[str, Any]] = {}


class VideoInfoRequest(BaseModel):
    """Request model for video info extraction"""
    url: str


class CreateJobRequest(BaseModel):
    """Request model for creating batch analysis job"""
    video_urls: List[str]
    prompt: str
    job_name: Optional[str] = None
    locale: Optional[str] = 'zh'  # 语言环境，默认为中文


class AnalyzePartRequest(BaseModel):
    """Request model for analyzing a single part of a series"""
    video_url: str
    prompt: str
    part_number: int
    quality: Optional[str] = 'best'  # 视频清晰度: 'best', '1080p', '720p', '480p', '360p', 'audio'
    locale: Optional[str] = 'zh'  # 语言环境，默认为中文


class GetPlayUrlRequest(BaseModel):
    """Request model for getting video play URL"""
    video_url: str
    quality: Optional[str] = 'best'


class PromptTemplate(BaseModel):
    """Prompt template model"""
    id: str
    name: str
    description: str
    prompt: str
    category: str


# Predefined prompt templates
PROMPT_TEMPLATES = [
    PromptTemplate(
        id="outline",
        name="生成笔记大纲",
        description="为视频内容生成结构化的笔记大纲",
        prompt="""请分析这个视频的内容，生成一个详细的笔记大纲。

要求：
1. 提取视频的核心主题和关键知识点
2. 按照逻辑顺序组织内容结构
3. 为每个部分添加时间戳（如果可识别）
4. 标注重点和难点
5. 用Markdown格式输出

输出格式：
# 视频标题
## 核心概要
- ...

## 详细大纲
### 1. 第一部分标题
- 要点1
- 要点2
...
""",
        category="笔记生成"
    ),
    PromptTemplate(
        id="knowledge_points",
        name="提取知识点",
        description="提取视频中的关键知识点和概念",
        prompt="""请提取这个视频中的所有关键知识点和概念。

要求：
1. 识别所有重要的概念、术语和原理
2. 为每个知识点提供简洁的解释
3. 标注知识点的重要程度（⭐⭐⭐ 核心 / ⭐⭐ 重要 / ⭐ 了解）
4. 如果有代码或公式，完整提取
5. 用Markdown格式输出

输出格式：
# 知识点清单

## 核心概念 ⭐⭐⭐
### 概念1
- 定义：...
- 要点：...

## 重要概念 ⭐⭐
...
""",
        category="知识提取"
    ),
    PromptTemplate(
        id="quiz",
        name="生成测验题",
        description="根据视频内容生成测验题目",
        prompt="""请根据这个视频的内容，生成一套测验题目。

要求：
1. 包含选择题、判断题和简答题
2. 覆盖视频的主要知识点
3. 题目难度分为：简单、中等、困难
4. 为每道题提供标准答案和解析
5. 用JSON格式输出

输出格式：
{
  "quiz": [
    {
      "type": "choice",
      "difficulty": "easy",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "..."
    },
    ...
  ]
}
""",
        category="测验生成"
    ),
    PromptTemplate(
        id="summary",
        name="生成视频摘要",
        description="生成简洁的视频内容摘要",
        prompt="""请为这个视频生成一个简洁的内容摘要。

要求：
1. 用3-5句话概括视频核心内容
2. 提取3-5个关键词
3. 说明适合的学习人群
4. 评估学习所需时间
5. 用Markdown格式输出

输出格式：
# 视频摘要

## 核心内容
...

## 关键词
- 关键词1
- 关键词2
...

## 适合人群
...

## 学习时长
约 X 分钟
""",
        category="内容摘要"
    ),
    PromptTemplate(
        id="transcript",
        name="生成逐字稿",
        description="生成带时间戳的视频逐字稿",
        prompt="""请为这个视频生成详细的逐字稿。

要求：
1. 尽可能还原视频中的所有语音内容
2. 为每个段落添加时间戳
3. 标注重要内容和强调部分
4. 修正口语化表达，使其更易阅读
5. 用Markdown格式输出

输出格式：
# 视频逐字稿

## [00:00] 开场
这里是开场内容...

## [01:30] 第一部分
**重点**：这里是重要内容...

...
""",
        category="文字转录"
    ),
]


@router.get("/templates")
async def get_prompt_templates() -> List[PromptTemplate]:
    """Get all available prompt templates"""
    return PROMPT_TEMPLATES


@router.post("/video-info")
async def get_video_info(request: VideoInfoRequest) -> Dict[str, Any]:
    """
    Extract video information without downloading
    """
    try:
        info = bilibili_service.extract_video_info(request.url)
        return {
            "success": True,
            "data": info
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/jobs")
async def create_job(request: CreateJobRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Create a new batch analysis job
    """
    try:
        print(f"📝 Creating job: video_urls={request.video_urls}, prompt={request.prompt[:50] if request.prompt else None}...")
        
        # Validate video URLs
        if not request.video_urls:
            error_msg = "At least one video URL is required"
            print(f"❌ Validation error: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Create job
        try:
            job_id = batch_analyzer.create_job(
                video_urls=request.video_urls,
                prompt=request.prompt,
                job_name=request.job_name,
                locale=request.locale or 'zh',  # 传递语言环境
            )
            print(f"✅ Job created: {job_id}")
        except Exception as e:
            error_msg = f"Failed to create job: {str(e)}"
            print(f"❌ Job creation error: {error_msg}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Start job in background
        try:
            background_tasks.add_task(batch_analyzer.run_job, job_id)
            print(f"✅ Job {job_id} added to background tasks")
        except Exception as e:
            error_msg = f"Failed to start job: {str(e)}"
            print(f"❌ Background task error: {error_msg}")
            # 即使后台任务启动失败，也返回成功（任务已创建）
        
        return {
            "success": True,
            "job_id": job_id,
            "message": "Job created and started"
        }
    except HTTPException:
        # 重新抛出 HTTPException
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"❌ Unexpected error: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/analyze-part")
async def analyze_part(request: AnalyzePartRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Analyze a single part of a video series (后台执行，不阻塞)
    """
    try:
        # 创建一个临时任务ID用于跟踪
        import uuid
        temp_job_id = f"part_analysis_{uuid.uuid4().hex[:8]}"
        
        # 在后台执行分析
        def run_analysis():
            try:
                return batch_analyzer.analyze_single_part(
                    video_url=request.video_url,
                    prompt=request.prompt,
                    part_number=request.part_number,
                    quality=request.quality,
                    locale=request.locale or 'zh',
                )
            except Exception as e:
                print(f"❌ 后台分析失败: {e}")
                import traceback
                traceback.print_exc()
                return {"success": False, "error": str(e)}
        
        # 添加到后台任务
        background_tasks.add_task(run_analysis)
        
        return {
            "success": True,
            "message": "分析任务已启动，正在后台处理中",
            "job_id": temp_job_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/get-play-url")
async def get_play_url(request: GetPlayUrlRequest) -> Dict[str, Any]:
    """
    Get fresh video play URL (B站CDN链接有时效性，需要重新获取)
    """
    try:
        result = bilibili_service.get_video_play_url(
            url=request.video_url,
            quality=request.quality
        )
        
        return {
            "success": result.get('success', False),
            "play_url": result.get('play_url', ''),
            "error": result.get('error')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get job status and progress
    """
    job = batch_analyzer.get_job_status(job_id)
    
    if not job:
        # 返回更友好的响应，而不是404错误
        return {
            "success": False,
            "data": {
                "status": "not_found",
                "message": "Job not found. It may have failed to create or the server was restarted.",
                "job_id": job_id
            }
        }
    
    return {
        "success": True,
        "data": job
    }


@router.get("/jobs")
async def list_active_jobs() -> Dict[str, Any]:
    """
    List all active jobs (results are stored in cache, not batch_results folder)
    """
    try:
        # 返回当前活跃的任务列表
        jobs_list = []
        for job_id, job in batch_analyzer.jobs.items():
            jobs_list.append({
                'job_id': job_id,
                'job_name': job.get('job_name', ''),
                'status': job.get('status', 'unknown'),
                'created_at': job.get('created_at', ''),
                'total_videos': job.get('total_videos', 0),
                'completed_videos': job.get('completed_videos', 0),
                'failed_videos': job.get('failed_videos', 0),
                'progress': job.get('progress', 0),
            })
        
        return {
            "success": True,
            "data": jobs_list,
            "message": "Results are stored in cache directory, not batch_results folder"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Cache Management Endpoints

@router.get("/cache/stats")
async def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics
    """
    try:
        stats = batch_analyzer.cache_service.get_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache/list")
async def list_cache() -> Dict[str, Any]:
    """
    List all cached videos
    """
    try:
        cached_videos = batch_analyzer.cache_service.list_cached_videos()
        return {
            "success": True,
            "data": cached_videos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/clear-expired")
async def clear_expired_cache(max_age_hours: int = 24) -> Dict[str, Any]:
    """
    Clear expired cache entries
    """
    try:
        cleared = batch_analyzer.cache_service.clear_expired(max_age_hours)
        return {
            "success": True,
            "message": f"Cleared {cleared} expired cache entries",
            "cleared_count": cleared
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/clear-all")
async def clear_all_cache() -> Dict[str, Any]:
    """
    Clear all cache entries
    """
    try:
        cleared = batch_analyzer.cache_service.clear_all()
        return {
            "success": True,
            "message": f"Cleared all {cleared} cache entries",
            "cleared_count": cleared
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

