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
            Analysis result dictionary
        """
        # Step 0: Check cache first
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
            # Step 1: Extract video info (also checks if multi-part)
            print(f"📋 Extracting video info: {video_url}")
            video_info = self.bilibili_service.extract_video_info(video_url)
            
            # 优化：如果检测到多P视频但没有指定分集，自动添加 ?p=1
            if '?p=' not in video_url and 'bilibili.com/video/' in video_url:
                # 检查是否是系列视频
                if video_info.get('_type') == 'playlist' or 'entries' in video_info:
                    print(f"⚠️  检测到多P视频，自动调整为第1集")
                    video_url = video_url.split('?')[0] + '?p=1'
                    print(f"✅ 调整后URL: {video_url}")
            
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

