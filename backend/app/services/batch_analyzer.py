"""
Batch video analysis service
"""
import os
import json
import uuid
import asyncio
import signal
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from pathlib import Path
from .bilibili_service import BilibiliService
from .gemini_service import GeminiService
from .cache_service import CacheService
from .video_analysis_service import VideoAnalysisService, AnalysisMethod
from ..models.video import AnalysisType


class BatchAnalyzer:
    """Service for batch analyzing videos"""
    
    def __init__(self, storage_dir: str = "batch_results", use_cache: bool = True, use_asr_doubao: bool = True):
        """
        Initialize batch analyzer
        
        Args:
            storage_dir: Directory to store analysis results
            use_cache: Whether to use cache for analysis results
            use_asr_doubao: Whether to use ASR+Doubao method (default True)
        """
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        
        self.bilibili_service = BilibiliService()
        self.gemini_service = GeminiService()  # 保留作为备选
        self.cache_service = CacheService(cache_dir="cache")
        self.video_analysis_service = VideoAnalysisService()  # 新的统一分析服务
        
        self.use_cache = use_cache
        self.use_asr_doubao = use_asr_doubao  # 默认使用 ASR + 豆包
        
        # Initialize thread pool for background preloading
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="preload_")
        
        print(f"📊 BatchAnalyzer initialized:")
        print(f"  - Storage: {storage_dir}")
        print(f"  - Cache: {'✅ Enabled' if use_cache else '❌ Disabled'}")
        print(f"  - Method: {'ASR+Doubao' if use_asr_doubao else 'Gemini'}")
        
        # Store active jobs
        self.jobs: Dict[str, Dict[str, Any]] = {}
    
    def create_job(
        self,
        video_urls: List[str],
        prompt: str,
        job_name: Optional[str] = None,
    ) -> str:
        """
        Create a new batch analysis job
        
        Args:
            video_urls: List of Bilibili video URLs or BV numbers
            prompt: Custom prompt for analysis
            job_name: Optional job name
            
        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        
        self.jobs[job_id] = {
            'job_id': job_id,
            'job_name': job_name or f"Batch Job {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'created_at': datetime.now().isoformat(),
            'status': 'created',
            'total_videos': len(video_urls),
            'completed_videos': 0,
            'failed_videos': 0,
            'video_urls': video_urls,
            'prompt': prompt,
            'results': [],
            'errors': [],
        }
        
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get job status
        
        Args:
            job_id: Job ID
            
        Returns:
            Job status dictionary or None if not found
        """
        return self.jobs.get(job_id)
    
    def _preload_next_part(self, current_video_url: str, prompt: str, current_part_number: int):
        """
        在后台预加载下一个分P（如果还没缓存）
        这个方法在线程池中异步执行，不阻塞当前请求
        
        Args:
            current_video_url: 当前视频URL（包含 ?p=X）
            prompt: 使用的prompt
            current_part_number: 当前P的编号
        """
        # 构建下一P的URL
        next_part_number = current_part_number + 1
        base_url = current_video_url.split('?')[0]
        next_video_url = f"{base_url}?p={next_part_number}"
        
        # 首先检查下一P是否已经在缓存中
        if self.use_cache:
            cached = self.cache_service.get(
                video_url=next_video_url,
                prompt=prompt,
                max_age_hours=24 * 7
            )
            
            if cached:
                print(f"⏭️  P{next_part_number} 已在缓存中，跳过预加载")
                return
        
        # 获取序列信息，检查下一P是否存在
        try:
            series_info = self.bilibili_service.extract_video_info(base_url, use_cache=True)
            
            if not series_info.get('is_series'):
                print(f"⏭️  这不是系列视频，无需预加载")
                return
            
            total_parts = series_info.get('total_parts', 0)
            
            if next_part_number > total_parts:
                print(f"⏭️  P{next_part_number} 不存在（总共 {total_parts} P），无需预加载")
                return
            
            print(f"🔄 开始后台预加载 P{next_part_number}...")
            
            # 在线程池中异步执行预加载（不阻塞当前请求）
            def preload_task():
                try:
                    result = self.analyze_single_part(
                        video_url=next_video_url,
                        prompt=prompt,
                        part_number=next_part_number,
                    )
                    
                    if result.get('success'):
                        print(f"✅ P{next_part_number} 预加载完成")
                    else:
                        print(f"⚠️  P{next_part_number} 预加载失败: {result.get('error', 'Unknown error')}")
                        
                except Exception as e:
                    print(f"⚠️  P{next_part_number} 预加载异常: {e}")
            
            # 提交到线程池异步执行
            if hasattr(self, 'executor'):
                self.executor.submit(preload_task)
            else:
                # 如果没有线程池，创建一个单线程执行
                import threading
                thread = threading.Thread(target=preload_task, daemon=True)
                thread.start()
                
        except Exception as e:
            print(f"⚠️  预加载检查失败: {e}")
    
    def analyze_single_part(
        self,
        video_url: str,
        prompt: str,
        part_number: int,
    ) -> Dict[str, Any]:
        """
        Analyze a single part of a video series
        
        Args:
            video_url: Bilibili video URL (should include ?p=X parameter)
            prompt: Custom prompt for analysis
            part_number: Part number (for metadata)
            
        Returns:
            Analysis result dictionary for this specific part
        """
        # 确保URL包含分P参数
        if '?p=' not in video_url:
            base_url = video_url.split('?')[0]
            video_url = f"{base_url}?p={part_number}"
        
        print(f"📺 分析第 {part_number} P: {video_url}")
        
        # 使用正常的单视频分析流程
        # 先检查缓存
        if self.use_cache:
            cached_result = self.cache_service.get(
                video_url=video_url,
                prompt=prompt,
                max_age_hours=24 * 7  # 7 days cache
            )
            
            if cached_result:
                print(f"✅ Using cached result for P{part_number}")
                cached_result['part_number'] = part_number
                
                # 即使使用缓存，也要触发下一P的预加载
                self._preload_next_part(video_url, prompt, part_number)
                
                return {
                    'success': True,
                    'from_cache': True,
                    **cached_result
                }
        
        video_file_path = None
        
        try:
            # 提取视频信息
            video_info = self.bilibili_service.extract_video_info(video_url)
            
            # 下载视频
            print(f"📥 Downloading P{part_number}: {video_info.get('title', '')}")
            download_result = self.bilibili_service.download_video(
                video_url,
                output_filename=f"temp_{video_info.get('bv_id', 'unknown')}_p{part_number}"
            )
            video_file_path = download_result['file_path']
            
            # 选择分析方法
            method = AnalysisMethod.ASR_DOUBAO if self.use_asr_doubao else AnalysisMethod.GEMINI
            
            # 调用统一的视频分析服务
            # 由于FastAPI已经在事件循环中，直接使用 asyncio.create_task 或在同步上下文中使用 run_coroutine_threadsafe
            import asyncio
            try:
                # 尝试获取当前事件循环
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 如果循环正在运行，使用 nest_asyncio 或创建任务
                    import nest_asyncio
                    nest_asyncio.apply()
                    result = loop.run_until_complete(
                        self.video_analysis_service.analyze_video(
                            video_path=video_file_path,
                            custom_prompt=prompt,
                            method=method,
                            video_url_for_cache=video_url
                        )
                    )
                else:
                    # 如果循环未运行，直接运行
                    result = loop.run_until_complete(
                        self.video_analysis_service.analyze_video(
                            video_path=video_file_path,
                            custom_prompt=prompt,
                            method=method,
                            video_url_for_cache=video_url
                        )
                    )
            except RuntimeError:
                # 如果没有事件循环，创建新的
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(
                        self.video_analysis_service.analyze_video(
                            video_path=video_file_path,
                            custom_prompt=prompt,
                            method=method,
                            video_url_for_cache=video_url
                        )
                    )
                finally:
                    loop.close()
            
            # 清理下载的视频文件
            try:
                os.remove(video_file_path)
                print(f"🗑️  Cleaned up: {video_file_path}")
            except Exception as e:
                print(f"⚠️  Failed to clean up: {e}")
            
            # 添加分P信息
            result['part_number'] = part_number
            result['series_title'] = download_result.get('series_title', '')
            result['video_info'] = {
                'title': video_info.get('title', ''),
                'bv_id': video_info.get('bv_id', ''),
                'url': video_url,
                'part_number': part_number,
            }
            
            # 保存到缓存
            if self.use_cache and result.get('success'):
                self.cache_service.set(
                    video_url=video_url,
                    prompt=prompt,
                    result=result,
                    metadata={'bv_id': video_info.get('bv_id', ''), 'title': video_info.get('title', ''), 'part_number': part_number}
                )
            
            # 后台预加载下一P（异步，不阻塞当前请求）
            self._preload_next_part(video_url, prompt, part_number)
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Failed to analyze P{part_number}: {error_msg}")
            
            # Cleanup on error
            if video_file_path and os.path.exists(video_file_path):
                try:
                    os.remove(video_file_path)
                except:
                    pass
            
            return {
                'success': False,
                'error': error_msg,
                'part_number': part_number,
                'video_url': video_url,
            }
    
    def analyze_video_with_prompt(
        self,
        video_url: str,
        prompt: str,
    ) -> Dict[str, Any]:
        """
        Download and analyze a single video with custom prompt
        
        Args:
            video_url: Bilibili video URL or BV number
            prompt: Custom prompt for analysis
            
        Returns:
            Analysis result dictionary (for series, contains all parts)
        """
        # Step 0: Extract video info to check if it's a series
        print(f"📋 Extracting video info: {video_url}")
        
        # 为了检测序列，移除URL中的?p=参数
        base_url = video_url.split('?')[0] if '?' in video_url else video_url
        video_info = self.bilibili_service.extract_video_info(base_url)
        
        # 如果是视频序列，返回序列信息和所有分P的占位符
        if video_info.get('is_series'):
            print(f"🎬 检测到视频序列: {video_info.get('series_title')}")
            print(f"📊 共 {video_info.get('total_parts')} 个分P")
            
            return {
                'success': True,
                'is_series': True,
                'series_title': video_info.get('series_title'),
                'total_parts': video_info.get('total_parts'),
                'parts': video_info.get('parts', []),  # 所有分P的信息
                'video_info': {
                    'title': video_info.get('series_title'),
                    'bv_id': video_info.get('bv_id'),
                    'url': video_url,
                },
                # 注意：序列视频不直接分析，前端需要逐个请求每个P的分析
                'message': '视频序列已识别，请前端逐个请求分P分析'
            }
        
        # 单P视频：正常分析流程
        # 检查缓存
        if self.use_cache:
            cached_result = self.cache_service.get(
                video_url=video_url,
                prompt=prompt,
                max_age_hours=24 * 7  # 7 days cache
            )
            
            if cached_result:
                print(f"✅ Using cached result for: {video_url}")
                return {
                    'success': True,
                    'from_cache': True,
                    **cached_result
                }
        
        video_file_path = None
        
        try:
            
            # Step 2: Download video
            print(f"📥 Downloading video: {video_info['title']}")
            download_result = self.bilibili_service.download_video(
                video_url,
                output_filename=f"temp_{video_info['bv_id']}"
            )
            video_file_path = download_result['file_path']
            
            # Step 3: Analyze video (使用新的统一分析服务)
            print(f"🤖 Analyzing video...")
            print(f"📋 Using Prompt (length: {len(prompt)} chars):")
            print("-" * 70)
            print(prompt[:500] + "..." if len(prompt) > 500 else prompt)
            print("-" * 70)
            
            # 选择分析方法
            analysis_method = AnalysisMethod.ASR_DOUBAO if self.use_asr_doubao else AnalysisMethod.GEMINI
            print(f"🔧 Analysis method: {analysis_method}")
            
            # 使用异步分析（需要在 async 上下文中运行）
            import asyncio
            try:
                # 如果当前不在 event loop 中，创建一个新的
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                
                # 运行异步分析
                analysis_result = loop.run_until_complete(
                    self.video_analysis_service.analyze_video(
                        video_file_path,
                        AnalysisType.CUSTOM,
                        prompt,
                        method=analysis_method,
                        video_url_for_cache=video_url  # 传递原始 URL 用于缓存
                    )
                )
                
            except Exception as e:
                if "timeout" in str(e).lower():
                    raise Exception("视频分析超时。建议：1)使用更短的视频 2)简化Prompt 3)使用?p=N指定单集")
                else:
                    raise
            
            # Combine results
            result = {
                'success': True,
                'video_info': video_info,
                'analysis': analysis_result,
                'analyzed_at': datetime.now().isoformat(),
                'from_cache': False,
            }
            
            # Step 4: Save to cache
            if self.use_cache:
                self.cache_service.set(
                    video_url=video_url,
                    prompt=prompt,
                    result=result,
                    metadata={'bv_id': video_info['bv_id'], 'title': video_info['title']}
                )
            
            return result
            
        except Exception as e:
            print(f"❌ Error analyzing video: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'video_url': video_url,
                'analyzed_at': datetime.now().isoformat(),
                'from_cache': False,
            }
        
        finally:
            # Cleanup downloaded video
            if video_file_path and os.path.exists(video_file_path):
                self.bilibili_service.cleanup_video(video_file_path)
    
    def run_job(
        self,
        job_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Dict[str, Any]:
        """
        Run batch analysis job
        
        Args:
            job_id: Job ID
            progress_callback: Optional callback function for progress updates
            
        Returns:
            Job result dictionary
        """
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        job['status'] = 'running'
        job['started_at'] = datetime.now().isoformat()
        
        results = []
        errors = []
        
        for idx, video_url in enumerate(job['video_urls'], 1):
            print(f"\n{'='*60}")
            print(f"Processing video {idx}/{job['total_videos']}: {video_url}")
            print(f"{'='*60}\n")
            
            # Analyze video
            result = self.analyze_video_with_prompt(video_url, job['prompt'])
            
            if result['success']:
                results.append(result)
                job['completed_videos'] += 1
            else:
                errors.append(result)
                job['failed_videos'] += 1
            
            # Update job progress
            job['results'] = results
            job['errors'] = errors
            job['progress'] = (idx / job['total_videos']) * 100
            
            # Call progress callback
            if progress_callback:
                progress_callback(job)
        
        # Mark job as completed
        job['status'] = 'completed'
        job['completed_at'] = datetime.now().isoformat()
        
        # Save results to file
        self.save_job_results(job_id)
        
        return job
    
    def save_job_results(self, job_id: str) -> str:
        """
        Save job results to JSON file
        
        Args:
            job_id: Job ID
            
        Returns:
            Path to saved file
        """
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        # Create filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{job['job_name'].replace(' ', '_')}_{timestamp}.json"
        filepath = os.path.join(self.storage_dir, filename)
        
        # Save to JSON
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(job, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Results saved to: {filepath}")
        job['saved_file'] = filepath
        
        return filepath
    
    def load_job_results(self, filepath: str) -> Dict[str, Any]:
        """
        Load job results from JSON file
        
        Args:
            filepath: Path to JSON file
            
        Returns:
            Job results dictionary
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def list_saved_jobs(self) -> List[Dict[str, Any]]:
        """
        List all saved job result files
        
        Returns:
            List of job file information
        """
        results = []
        
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.storage_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        results.append({
                            'filename': filename,
                            'filepath': filepath,
                            'job_name': data.get('job_name', ''),
                            'created_at': data.get('created_at', ''),
                            'total_videos': data.get('total_videos', 0),
                            'completed_videos': data.get('completed_videos', 0),
                            'failed_videos': data.get('failed_videos', 0),
                        })
                except Exception as e:
                    print(f"⚠️ Failed to load {filename}: {str(e)}")
        
        # Sort by creation time (newest first)
        results.sort(key=lambda x: x['created_at'], reverse=True)
        
        return results

