"""
Gemini AI service for video analysis
"""
import os
import tempfile
import time
from typing import Dict, Any, Optional
import google.generativeai as genai
from ..core.config import settings
from ..models.video import AnalysisType

class GeminiService:
    """Service for interacting with Gemini AI API"""
    
    def __init__(self):
        """Initialize Gemini service"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        # 使用更稳定的模型版本
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def analyze_video(self, video_path: str, analysis_type: AnalysisType, custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze video using Gemini AI
        
        Args:
            video_path: Path to the video file
            analysis_type: Type of analysis to perform
            custom_prompt: Optional custom prompt
            
        Returns:
            Analysis results as dictionary
        """
        start_time = time.time()
        
        try:
            # 检查文件大小
            file_size = os.path.getsize(video_path)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                raise Exception(f"文件太大: {file_size / 1024 / 1024:.1f}MB，最大支持100MB")
            
            print(f"📤 Uploading video: {video_path} ({file_size / 1024 / 1024:.1f}MB)")
            
            # 添加重试机制上传文件
            video_file = self._upload_with_retry(video_path, max_retries=3)
            
            # Wait for processing with timeout
            max_wait_time = 300  # 5分钟超时
            wait_start = time.time()
            check_count = 0
            
            while video_file.state.name == "PROCESSING":
                elapsed = time.time() - wait_start
                check_count += 1
                print(f"⏳ Processing video... ({elapsed:.0f}s elapsed, check #{check_count})")
                
                if elapsed > max_wait_time:
                    # 清理文件
                    try:
                        genai.delete_file(video_file.name)
                    except:
                        pass
                    raise Exception(f"视频处理超时（{max_wait_time}秒），请尝试较小的视频文件")
                
                time.sleep(5)  # 增加检查间隔到5秒
                try:
                    video_file = genai.get_file(video_file.name)
                except Exception as e:
                    print(f"⚠️ 获取文件状态失败: {e}")
                    # 重试一次
                    time.sleep(2)
                    try:
                        video_file = genai.get_file(video_file.name)
                    except:
                        raise Exception("无法获取视频处理状态，请重试")
            
            if video_file.state.name == "FAILED":
                raise Exception("Video processing failed")
            
            # Generate prompt based on analysis type
            prompt = self._get_analysis_prompt(analysis_type, custom_prompt)
            
            # Analyze video with timeout
            print(f"🤖 Analyzing video with prompt type: {analysis_type}")
            print(f"📝 Prompt length: {len(prompt)} characters")
            print("=" * 70)
            print("📋 实际传入的 Prompt:")
            print("-" * 70)
            print(prompt)
            print("=" * 70)
            
            try:
                # 设置生成配置，包括超时
                generation_config = genai.types.GenerationConfig(
                    max_output_tokens=2048,  # 限制输出长度
                    temperature=0.7,
                )
                
                analysis_start = time.time()
                response = self.model.generate_content(
                    [video_file, prompt],
                    generation_config=generation_config
                )
                analysis_time = time.time() - analysis_start
                print(f"✅ Analysis completed in {analysis_time:.1f}s")
                
                # 检查响应
                if not response.text:
                    raise Exception("AI分析返回空结果，请重试")
                    
            except Exception as e:
                error_msg = str(e)
                if "timeout" in error_msg.lower():
                    raise Exception("AI分析超时，请尝试较短的视频或简化分析类型")
                elif "quota" in error_msg.lower():
                    raise Exception("API配额不足，请稍后重试")
                else:
                    raise Exception(f"AI分析失败: {error_msg}")
            
            # Clean up uploaded file
            try:
                genai.delete_file(video_file.name)
                print("🗑️ Cleaned up uploaded file")
            except Exception as e:
                print(f"⚠️ Failed to delete file: {e}")
            
            processing_time = time.time() - start_time
            
            return {
                "success": True,
                "analysis_type": analysis_type,
                "result": {
                    "content": response.text,
                    "video_info": {
                        "name": video_file.display_name,
                        "size_bytes": getattr(video_file, 'size_bytes', 0),
                        "mime_type": getattr(video_file, 'mime_type', 'unknown')
                    }
                },
                "processing_time": processing_time
            }
            
        except Exception as e:
            processing_time = time.time() - start_time
            return {
                "success": False,
                "analysis_type": analysis_type,
                "error": str(e),
                "processing_time": processing_time
            }
    
    def _get_analysis_prompt(self, analysis_type: AnalysisType, custom_prompt: Optional[str] = None) -> str:
        """Generate analysis prompt based on type"""
        
        # 如果是 CUSTOM 类型，必须提供 custom_prompt
        if analysis_type == AnalysisType.CUSTOM:
            if not custom_prompt:
                raise ValueError("CUSTOM analysis type requires custom_prompt to be provided")
            return custom_prompt
        
        # 如果提供了 custom_prompt，优先使用
        if custom_prompt:
            return custom_prompt
        
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
    
    def _upload_with_retry(self, video_path: str, max_retries: int = 3):
        """
        带重试机制的文件上传
        """
        for attempt in range(max_retries):
            try:
                print(f"📤 尝试上传 (第{attempt + 1}次)...")
                video_file = genai.upload_file(path=video_path)
                print(f"✅ 上传成功")
                return video_file
            except Exception as e:
                error_msg = str(e).lower()
                print(f"❌ 上传失败 (第{attempt + 1}次): {e}")
                
                # 检查特定错误类型
                if "503" in error_msg or "service unavailable" in error_msg:
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 5  # 递增等待时间
                        print(f"⏳ 服务不可用，等待{wait_time}秒后重试...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise Exception("Gemini API服务不可用，请稍后重试。可能原因：1)API配额超限 2)服务维护 3)网络问题")
                
                elif "quota" in error_msg or "limit" in error_msg:
                    raise Exception("API配额已用完，请检查您的Gemini API配额或等待配额重置")
                
                elif "invalid" in error_msg and "key" in error_msg:
                    raise Exception("API密钥无效，请检查GEMINI_API_KEY配置")
                
                elif "permission" in error_msg or "forbidden" in error_msg:
                    raise Exception("API权限不足，请检查您的Gemini API权限设置")
                
                else:
                    # 其他错误，重试
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 2
                        print(f"⏳ 等待{wait_time}秒后重试...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise e
        
        raise Exception(f"上传失败，已重试{max_retries}次")
    
    def get_analysis_types(self) -> Dict[str, Any]:
        """Get available analysis types and descriptions"""
        return {
            "analysis_types": [
                {"value": "general", "label": "通用分析"},
                {"value": "educational", "label": "教育分析"},
                {"value": "summary", "label": "内容摘要"},
                {"value": "quiz", "label": "测试生成"}
            ],
            "descriptions": {
                "general": "全面分析视频内容，包括主题、结构、质量等",
                "educational": "从教育角度分析，评估教学价值和学习成果",
                "summary": "提取核心要点，生成结构化摘要",
                "quiz": "基于视频内容生成测试题目和答案"
            }
        }
