"""
视频分析服务（集成多种分析方案）
"""
import os
import time
from typing import Dict, Any, Optional
from enum import Enum
from ..models.video import AnalysisType
from .gemini_service import GeminiService
from .asr_service import AsrService
from .doubao_service import DoubaoService
from .volcano_service import VolcanoService
from .file_upload_service import FileUploadService
from .cache_service import CacheService
from .knowledge_point_extractor import KnowledgePointExtractor


class AnalysisMethod(str, Enum):
    """视频分析方法"""
    ASR_DOUBAO = "asr_doubao"  # ASR识别 + 豆包生成（默认）
    GEMINI = "gemini"  # Gemini 直接分析


class VideoAnalysisService:
    """
    视频分析服务
    支持多种分析方案：
    1. ASR + 豆包（默认）：下载视频 → ASR识别逐字稿 → 豆包生成大纲
    2. Gemini：直接上传视频给 Gemini 分析
    """
    
    def __init__(self, use_cache: bool = True):
        """初始化视频分析服务"""
        self.gemini_service = GeminiService()
        self.asr_service = AsrService()
        self.doubao_service = DoubaoService()  # 保留但不使用
        self.volcano_service = VolcanoService()  # 使用火山引擎
        self.file_upload_service = FileUploadService()
        self.cache_service = CacheService(cache_dir="cache")
        self.knowledge_point_extractor = KnowledgePointExtractor()
        
        self.use_cache = use_cache
        
        # 默认使用 ASR + 火山引擎方案
        self.default_method = AnalysisMethod.ASR_DOUBAO
        print(f"🎬 VideoAnalysisService initialized (default: {self.default_method} with Volcano Engine, cache: {'✅' if use_cache else '❌'})")
    
    async def analyze_video(
        self,
        video_path: str,
        analysis_type: AnalysisType = AnalysisType.CUSTOM,
        custom_prompt: Optional[str] = None,
        method: Optional[AnalysisMethod] = None,
        video_url_for_cache: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        分析视频
        
        Args:
            video_path: 视频文件路径
            analysis_type: 分析类型
            custom_prompt: 自定义提示词
            method: 分析方法（None 则使用默认方法）
            
        Returns:
            分析结果字典
        """
        start_time = time.time()
        method = method or self.default_method
        
        print(f"🎬 Starting video analysis...")
        print(f"📁 Video: {video_path}")
        print(f"🔧 Method: {method}")
        print(f"📋 Analysis Type: {analysis_type}")
        
        try:
            if method == AnalysisMethod.ASR_DOUBAO:
                result = await self._analyze_with_asr_doubao(
                    video_path,
                    analysis_type,
                    custom_prompt,
                    video_url_for_cache
                )
            elif method == AnalysisMethod.GEMINI:
                result = self._analyze_with_gemini(
                    video_path,
                    analysis_type,
                    custom_prompt
                )
            else:
                raise ValueError(f"Unsupported analysis method: {method}")
            
            processing_time = time.time() - start_time
            result['processing_time'] = processing_time
            result['method'] = method
            
            print(f"✅ Analysis completed in {processing_time:.1f}s")
            return result
            
        except Exception as e:
            processing_time = time.time() - start_time
            print(f"❌ Analysis failed: {str(e)}")
            return {
                "success": False,
                "analysis_type": analysis_type,
                "method": method,
                "error": str(e),
                "processing_time": processing_time
            }
    
    async def _analyze_with_asr_doubao(
        self,
        video_path: str,
        analysis_type: AnalysisType,
        custom_prompt: Optional[str],
        video_url_for_cache: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        使用 ASR + 火山引擎方案分析视频
        
        步骤：
        1. 上传视频到文件服务器获取 URL
        2. 检查 ASR 缓存，如果有则跳过 ASR
        3. 调用 ASR 识别逐字稿（如果没有缓存）
        4. 保存 ASR 结果到缓存
        5. 使用火山引擎根据逐字稿生成大纲
        """
        print("=" * 70)
        print("📋 Method: ASR + Volcano Engine")
        print("=" * 70)
        
        # Step 1: 获取视频 URL
        video_url = self._get_or_upload_video_url(video_path)
        print(f"📹 Video URL: {video_url}")
        
        # 用于缓存的 URL（通常是原始 Bilibili URL）
        cache_url = video_url_for_cache or video_url
        
        # Step 2: 检查 ASR 缓存
        transcript = None
        asr_task_id = None
        from_cache = False
        
        if self.use_cache:
            print(f"\n🔍 Checking ASR cache for: {cache_url}")
            transcript = self.cache_service.get_asr_transcript(cache_url)
            
            if transcript:
                print(f"✅ ASR cache hit! Skipping ASR recognition")
                from_cache = True
        
        # Step 3: ASR 识别逐字稿（如果没有缓存）
        if not transcript:
            print(f"\n📝 Step 1: ASR Recognition")
            asr_task = await self.asr_service.create_async_task(video_url)
            asr_task_id = asr_task.id
            print(f"✅ ASR task created: {asr_task_id}")
            
            # 等待 ASR 完成
            asr_result = await self.asr_service.wait_for_completion(asr_task_id)
            # 提取带时间戳的逐字稿
            transcript = self.asr_service.extract_transcript(asr_result, with_timestamps=True)
            print(f"✅ Transcript extracted ({len(transcript)} chars)")
            
            # Step 4: 保存 ASR 结果到缓存
            if self.use_cache:
                self.cache_service.set_asr_transcript(
                    cache_url,
                    transcript,
                    metadata={
                        'asr_task_id': asr_task_id,
                        'video_url': video_url,
                        'video_path': video_path
                    }
                )
        
        # Step 5: 知识点提取（并行处理长文本）
        print(f"\n📚 Step 2: Knowledge Point Extraction")
        knowledge_points = await self.knowledge_point_extractor.extract_knowledge_points(transcript)
        
        print(f"✅ Knowledge points extracted: {len(knowledge_points)}")
        
        # 格式化为 JSON 字符串
        import json
        knowledge_points_json = json.dumps(
            {"knowledge_points": knowledge_points},
            ensure_ascii=False,
            indent=2
        )
        
        return {
            "success": True,
            "analysis_type": analysis_type,
            "result": {
                "content": knowledge_points_json,  # JSON 格式的知识点列表
                "knowledge_points": knowledge_points,  # 结构化的知识点列表
                "transcript": transcript,  # 完整逐字稿（带时间戳）
                "video_info": {
                    "path": video_path,
                    "url": video_url,
                    "size_bytes": os.path.getsize(video_path) if os.path.exists(video_path) else 0
                },
                "asr_task_id": asr_task_id,
                "asr_from_cache": from_cache,
                "knowledge_point_count": len(knowledge_points)
            }
        }
    
    def _analyze_with_gemini(
        self,
        video_path: str,
        analysis_type: AnalysisType,
        custom_prompt: Optional[str]
    ) -> Dict[str, Any]:
        """
        使用 Gemini 方案分析视频（保留原有方案）
        """
        print("=" * 70)
        print("🤖 Method: Gemini")
        print("=" * 70)
        
        return self.gemini_service.analyze_video(
            video_path,
            analysis_type,
            custom_prompt
        )
    
    def _get_or_upload_video_url(self, video_path: str) -> str:
        """
        获取或上传视频 URL
        
        如果 video_path 已经是 URL，直接返回
        如果是本地文件，上传到文件服务器
        
        Args:
            video_path: 视频路径
            
        Returns:
            视频 URL
        """
        # 检查是否已经是 URL
        if video_path.startswith(('http://', 'https://')):
            print(f"✅ Video is already a URL: {video_path}")
            return video_path
        
        # 上传本地文件到文件服务器
        print(f"📤 Uploading local video to file server: {video_path}")
        try:
            video_url = self.file_upload_service.upload_video_for_asr(video_path)
            if not video_url:
                raise Exception("File upload service returned None")
            print(f"✅ Video uploaded: {video_url}")
            return video_url
        except Exception as e:
            print(f"❌ File upload failed: {e}")
            raise Exception(f"Failed to upload video to file server: {str(e)}")
    
    def _get_analysis_prompt(
        self,
        analysis_type: AnalysisType,
        custom_prompt: Optional[str] = None
    ) -> str:
        """
        生成分析提示词（复用 Gemini 的提示词）
        
        Args:
            analysis_type: 分析类型
            custom_prompt: 自定义提示词
            
        Returns:
            提示词文本
        """
        # 如果是 CUSTOM 类型，必须提供 custom_prompt
        if analysis_type == AnalysisType.CUSTOM:
            if not custom_prompt:
                raise ValueError("CUSTOM analysis type requires custom_prompt")
            return custom_prompt
        
        # 如果提供了 custom_prompt，优先使用
        if custom_prompt:
            return custom_prompt
        
        # 使用预设提示词（与 Gemini 保持一致）
        prompts = {
            AnalysisType.GENERAL: """
            请分析这个视频的内容，包括：
            1. 主要主题和内容概述
            2. 关键信息点
            3. 视频结构和组织方式
            4. 目标受众
            5. 内容质量评估
            请用中文回答。
            """,
            
            AnalysisType.EDUCATIONAL: """
            请从教育角度分析这个视频，包括：
            1. 教学目标和学习成果
            2. 知识点和技能点
            3. 教学方法和策略
            4. 适合的学习者水平
            5. 教育价值和改进建议
            6. 可以设计的练习或作业
            请用中文回答。
            """,
            
            AnalysisType.SUMMARY: """
            请为这个视频提供详细摘要，包括：
            1. 核心要点（3-5个主要观点）
            2. 关键结论或建议
            3. 重要数据或案例
            4. 行动建议（如适用）
            5. 一句话总结
            请用中文回答，结构化呈现。
            """,
            
            AnalysisType.QUIZ: """
            基于这个视频内容，请生成一套测试题，包括：
            1. 5个选择题（每题4个选项，标明正确答案）
            2. 3个简答题
            3. 1个综合分析题
            4. 提供所有题目的参考答案
            请确保题目覆盖视频的主要知识点，难度适中。
            请用中文回答。
            """
        }
        
        return prompts.get(analysis_type, prompts[AnalysisType.GENERAL])





