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
from .file_cleanup_service import FileCleanupService
from .file_upload_service import FileUploadService
from ..models.video import AnalysisType


class BatchAnalyzer:
    """Service for batch analyzing videos"""
    
    def __init__(self, use_cache: bool = True, use_asr_doubao: bool = True, auto_preload_next_part: bool = False):
        """
        Initialize batch analyzer
        
        Args:
            use_cache: Whether to use cache for analysis results
            use_asr_doubao: Whether to use ASR+Doubao method (default True)
            auto_preload_next_part: Whether to automatically preload next part for multi-part videos (default False, disabled for testing)
        """
        self.bilibili_service = BilibiliService()
        self.gemini_service = GeminiService()  # 保留作为备选
        self.cache_service = CacheService(cache_dir="cache")
        self.video_analysis_service = VideoAnalysisService()  # 新的统一分析服务
        self.file_upload_service = FileUploadService()  # 文件上传服务（用于上传视频到CDN）
        
        self.use_cache = use_cache
        self.use_asr_doubao = use_asr_doubao  # 默认使用 ASR + 豆包
        self.auto_preload_next_part = auto_preload_next_part  # 自动预加载下一P（默认关闭，用于测试）
        
        # Initialize thread pool for background preloading
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="preload_")
        
        # Initialize file cleanup service
        self.cleanup_service = FileCleanupService()
        
        print(f"📊 BatchAnalyzer initialized:")
        print(f"  - Cache: {'✅ Enabled' if use_cache else '❌ Disabled'}")
        print(f"  - Method: {'ASR+Doubao' if use_asr_doubao else 'Gemini'}")
        print(f"  - Auto Preload Next Part: {'✅ Enabled' if auto_preload_next_part else '❌ Disabled (for testing)'}")
        
        # Store active jobs
        self.jobs: Dict[str, Dict[str, Any]] = {}
    
    def _save_pending_cdn_url(self, video_url: str, cdn_url: str, bv_id: str, part_number: Optional[int] = None):
        """
        保存待写入的CDN URL（当分析结果缓存尚未保存时使用）
        
        Args:
            video_url: 原始视频URL
            cdn_url: CDN URL
            bv_id: 视频BV ID
            part_number: 分P编号（可选）
        """
        try:
            cache_key = f"pending_cdn_url_{bv_id}"
            if part_number is not None:
                cache_key += f"_p{part_number}"
            
            cache_file = os.path.join(self.cache_service.cache_dir, f"{cache_key}.json")
            cache_data = {
                'cdn_url': cdn_url,
                'video_url': video_url,
                'bv_id': bv_id,
                'part_number': part_number,
                'cached_at': datetime.now().isoformat()
            }
            
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ CDN URL已保存到临时缓存: {cache_key}")
        except Exception as e:
            print(f"⚠️ 保存临时CDN URL缓存失败: {str(e)}")
    
    def _get_pending_cdn_url(self, bv_id: str, part_number: Optional[int] = None) -> Optional[str]:
        """
        获取待写入的CDN URL（如果存在）
        
        Args:
            bv_id: 视频BV ID
            part_number: 分P编号（可选）
            
        Returns:
            CDN URL，如果不存在则返回None
        """
        import time
        
        # 构建基础缓存key
        cache_key_base = f"pending_cdn_url_{bv_id}"
        if part_number is not None:
            cache_key_base += f"_p{part_number}"
        
        # 尝试读取正确文件名和可能的拼写错误文件名（向后兼容）
        possible_keys = [
            cache_key_base,  # 正确的文件名: pending_cdn_url_xxx
            cache_key_base.replace("pending_cdn_url", "pendingg_cdn_url"),  # 拼写错误的旧文件名: pendingg_cdn_url_xxx
        ]
        
        for cache_key in possible_keys:
            cache_file = os.path.join(self.cache_service.cache_dir, f"{cache_key}.json")
            
            if not os.path.exists(cache_file):
                continue
            
            # 使用重试机制处理文件占用问题
            max_retries = 3
            retry_delay = 0.1  # 100ms
            
            for attempt in range(max_retries):
                try:
                    # 尝试读取文件
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                        cdn_url = cache_data.get('cdn_url')
                        if cdn_url:
                            print(f"✅ 找到待写入的CDN URL: {cdn_url[:100]}...")
                            
                            # 读取成功后，尝试删除临时文件（使用重试）
                            # 确保文件句柄已关闭后再删除
                            time.sleep(0.05)  # 短暂延迟确保文件句柄已释放
                            
                            for delete_attempt in range(max_retries):
                                try:
                                    if os.path.exists(cache_file):
                                        os.remove(cache_file)
                                        print(f"🗑️ 已删除临时CDN URL缓存: {cache_key}")
                                    break
                                except (PermissionError, OSError) as e:
                                    if delete_attempt < max_retries - 1:
                                        time.sleep(retry_delay * (delete_attempt + 1))
                                    else:
                                        print(f"⚠️ 删除临时CDN URL缓存失败（文件可能被占用）: {cache_key}")
                            
                            return cdn_url
                        break  # 文件存在但无CDN URL，跳出重试循环
                except (PermissionError, OSError) as e:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay * (attempt + 1))
                    else:
                        print(f"⚠️ 读取临时CDN URL缓存失败（文件被占用）: {cache_key}, 错误: {str(e)}")
                except Exception as e:
                    print(f"⚠️ 读取临时CDN URL缓存失败: {cache_key}, 错误: {str(e)}")
                    break  # 其他错误不重试
        
        return None
    
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
        quality: str = 'best',
    ) -> Dict[str, Any]:
        """
        Analyze a single part of a video series
        
        Args:
            video_url: Bilibili video URL (should include ?p=X parameter)
            quality: Video quality - 'best', '1080p', '720p', '480p', '360p', or 'audio'
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
                
                # 🎬 CDN URL已直接保存在缓存中，无需额外检查
                if 'result' in cached_result and 'video_info' in cached_result['result']:
                    video_info = cached_result['result']['video_info']
                    if 'url' in video_info:
                        print(f"✅ 缓存中包含CDN URL: {video_info['url'][:100]}...")
                    elif 'path' in video_info:
                        print(f"ℹ️ 缓存中为本地路径，CDN上传可能尚未完成")
                
                # 即使使用缓存，也要触发下一P的预加载（如果启用）
                if self.auto_preload_next_part:
                    self._preload_next_part(video_url, prompt, part_number)
                
                return {
                    'success': True,
                    'from_cache': True,
                    **cached_result
                }
        
        video_file_path = None
        
        try:
            # 提取视频信息（移除?p=参数以获取完整系列信息）
            base_url_for_info = video_url.split('?')[0] if '?' in video_url else video_url
            video_info = self.bilibili_service.extract_video_info(base_url_for_info)
            
            # 🎬 第一步：获取视频直接播放URL（用于前端播放，不需要下载）
            print(f"🎬 获取P{part_number}的播放地址: {video_info.get('title', '')} (Quality: {quality})")
            play_url_result = self.bilibili_service.get_video_play_url(video_url, quality)
            
            if not play_url_result.get('success'):
                raise Exception(f"无法获取视频播放地址: {play_url_result.get('error', '未知错误')}")
            
            video_play_url = play_url_result['play_url']
            print(f"✅ 获取到播放地址: {video_play_url[:100]}...")
            
            # 🎵🎬 第二步：并行下载音频和视频
            bv_id = video_info.get('bv_id', 'unknown')
            audio_filename = f"audio_{bv_id}_p{part_number}"
            video_filename = f"video_{bv_id}_p{part_number}"
            
            print(f"🎵🎬 并行下载音频和视频 for P{part_number}: {video_info.get('title', '')}")
            
            # 🎬 异步处理视频上传到CDN（不阻塞音频分析）
            def upload_video_to_cdn_async(video_file_path: str, bv_id: str, part_num: int, original_video_url: str):
                """异步上传视频到CDN并缓存"""
                try:
                    # 上传视频到CDN
                    print(f"📤 开始上传视频到CDN: {os.path.basename(video_file_path)}")
                    cdn_url = self.file_upload_service.upload_file(video_file_path, file_key="file0")
                    
                    if cdn_url:
                        print(f"✅ 视频已上传到CDN: {cdn_url[:100]}...")
                        
                        # 🔄 直接更新分析结果缓存，将CDN URL保存到video_info中
                        try:
                            print(f"🔍 [上传完成-P{part_num}] 尝试读取分析结果缓存: {original_video_url}")
                            # 尝试读取分析结果缓存
                            analysis_cache = self.cache_service.get(
                                video_url=original_video_url,
                                prompt="提取视频中的知识点",  # 默认prompt
                                max_age_hours=24 * 7
                            )
                            
                            if analysis_cache:
                                print(f"✅ [上传完成-P{part_num}] 找到分析结果缓存，准备更新CDN URL")
                                
                                # 更新缓存中的视频URL为CDN URL，移除本地路径
                                updated = False
                                
                                # 1. 更新 result.video_info.url（分析结果中的video_info）
                                if 'result' in analysis_cache and 'video_info' in analysis_cache['result']:
                                    old_url = analysis_cache['result']['video_info'].get('url', '')
                                    analysis_cache['result']['video_info']['url'] = cdn_url
                                    # 移除本地路径（如果存在）
                                    analysis_cache['result']['video_info'].pop('path', None)
                                    updated = True
                                    print(f"✅ [上传完成-P{part_num}] 更新 result.video_info.url: {old_url[:50]}... → {cdn_url[:50]}...")
                                
                                # 2. 更新顶层的 video_info.url（如果存在）
                                if 'video_info' in analysis_cache:
                                    old_url = analysis_cache['video_info'].get('url', '')
                                    analysis_cache['video_info']['url'] = cdn_url
                                    analysis_cache['video_info'].pop('path', None)
                                    updated = True
                                    print(f"✅ [上传完成-P{part_num}] 更新 video_info.url: {old_url[:50]}... → {cdn_url[:50]}...")
                                
                                if updated:
                                    # 重新保存更新后的缓存
                                    print(f"💾 [上传完成-P{part_num}] 保存更新后的缓存...")
                                    self.cache_service.set(
                                        video_url=original_video_url,
                                        prompt="提取视频中的知识点",
                                        result=analysis_cache,
                                        metadata=analysis_cache.get('metadata', {})
                                    )
                                    print(f"✅ [上传完成-P{part_num}] 已更新分析结果缓存，CDN URL已保存到video_info: {cdn_url[:100]}...")
                                else:
                                    print(f"⚠️ [上传完成-P{part_num}] 缓存结构不匹配，无法更新CDN URL")
                                
                                # 🗑️ 删除临时CDN URL缓存（如果存在）
                                try:
                                    cache_key = f"pending_cdn_url_{bv_id}"
                                    if part_num is not None:
                                        cache_key += f"_p{part_num}"
                                    cache_file = os.path.join(self.cache_service.cache_dir, f"{cache_key}.json")
                                    if os.path.exists(cache_file):
                                        os.remove(cache_file)
                                        print(f"🗑️ [上传完成-P{part_num}] 已删除临时CDN URL缓存: {cache_key}")
                                except Exception as e:
                                    pass  # 忽略删除临时文件的错误
                            else:
                                # 🔄 分析结果缓存尚未保存，先保存到临时CDN URL缓存
                                # 这样当分析结果保存时，可以检查并合并CDN URL
                                print(f"ℹ️ [上传完成-P{part_num}] 分析结果缓存尚未保存，先保存CDN URL到临时缓存")
                                self._save_pending_cdn_url(original_video_url, cdn_url, bv_id, part_num)
                        except Exception as e:
                            print(f"⚠️ 更新分析结果缓存失败: {str(e)}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"❌ 视频上传到CDN失败")
                    
                    # 清理下载的视频文件
                    self.cleanup_service.cleanup_file(video_file_path)
                    
                except Exception as e:
                    print(f"❌ 视频上传到CDN过程出错: {str(e)}")
                    import traceback
                    traceback.print_exc()
            
            # 使用线程池并行下载
            executor = ThreadPoolExecutor(max_workers=2)
            try:
                audio_future = executor.submit(
                    self.bilibili_service.download_audio,
                    video_url,
                    audio_filename
                )
                video_future = executor.submit(
                    self.bilibili_service.download_video,
                    video_url,
                    video_filename,
                    quality
                )
                
                # 等待音频下载完成（音频先完成，可以立即开始ASR）
                print(f"⏳ 等待音频下载完成...")
                audio_result = audio_future.result()
                audio_file_path = audio_result['file_path']
                print(f"✅ 音频下载完成: {audio_result.get('file_size', 0) / 1024 / 1024:.2f} MB")
                
                # 音频下载完成后，立即开始ASR分析（不等待视频）
                # 视频下载在后台继续，完成后异步上传到CDN
                
                # 在后台线程中处理视频上传（不阻塞）
                def handle_video_download_and_upload():
                    try:
                        print(f"⏳ 等待视频下载完成...")
                        video_result = video_future.result()
                        video_file_path = video_result['file_path']
                        print(f"✅ 视频下载完成: {video_result.get('file_size', 0) / 1024 / 1024:.2f} MB")
                        
                        # 上传到CDN并缓存
                        upload_video_to_cdn_async(video_file_path, bv_id, part_number, video_url)
                    except Exception as e:
                        print(f"❌ 视频下载或上传过程出错: {str(e)}")
                        import traceback
                        traceback.print_exc()
                
                # 在后台线程中执行视频下载完成后的处理（不阻塞）
                self.executor.submit(handle_video_download_and_upload)
                
            finally:
                # 不关闭executor，让视频下载继续在后台进行
                pass
            
            # 使用音频文件进行ASR分析
            video_file_path = audio_file_path
            
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
            
            # 🧹 立即清理下载的音频文件（不再需要）
            self.cleanup_service.cleanup_file(video_file_path)
            
            # 🎬 检查是否有待写入的CDN URL（上传先完成的情况）
            bv_id = video_info.get('bv_id', '')
            pending_cdn_url = self._get_pending_cdn_url(bv_id, part_number)
            
            # 🎬 video_info中的url应该存储CDN URL（如果已上传），否则暂时保留原始URL
            # 与单P视频保持一致：更新完整的video_info，而不是重新构建
            video_info_copy = video_info.copy()
            if pending_cdn_url:
                video_info_copy['url'] = pending_cdn_url  # 🎬 优先使用CDN URL
                print(f"✅ 使用待写入的CDN URL更新video_info: {pending_cdn_url[:100]}...")
            
            # ⚠️ 移除video_info中的play_url（如果存在），避免缓存过期URL
            if 'play_url' in video_info_copy:
                video_info_copy.pop('play_url')
            
            # 添加分P信息到result（与单P视频结构保持一致）
            result['part_number'] = part_number
            # 从video_info获取系列标题（如果是系列视频）
            result['series_title'] = video_info.get('series_title', '') if video_info.get('is_series') else ''
            
            # 🎬 更新result中的video_info（与单P视频保持一致的结构）
            result['video_info'] = video_info_copy
            
            # 🎬 同时更新analysis.result.video_info中的url（如果存在）
            if 'analysis' in result and 'result' in result['analysis'] and 'video_info' in result['analysis']['result']:
                if pending_cdn_url:
                    result['analysis']['result']['video_info']['url'] = pending_cdn_url
                    result['analysis']['result']['video_info'].pop('path', None)  # 移除本地路径
                    print(f"✅ 使用待写入的CDN URL更新analysis.result.video_info: {pending_cdn_url[:100]}...")
            
            # Step 4: Save to cache（移除播放URL和本地路径，只保存CDN URL）
            # 与单P视频保持完全一致的缓存保存逻辑
            if self.use_cache and result.get('success'):
                # 创建缓存副本，确保不包含播放URL
                cache_result = result.copy()
                cache_result.pop('video_play_url', None)  # 移除顶层播放URL（如果存在）
                
                # 🎬 移除本地路径，只保留CDN URL（如果已上传）
                if 'analysis' in cache_result and 'result' in cache_result['analysis'] and 'video_info' in cache_result['analysis']['result']:
                    video_info_cache = cache_result['analysis']['result']['video_info']
                    # 优先使用待写入的CDN URL，其次使用已有的url
                    if pending_cdn_url:
                        video_info_cache['url'] = pending_cdn_url
                        video_info_cache.pop('path', None)  # 移除本地路径
                        print(f"✅ 使用待写入的CDN URL: {pending_cdn_url[:100]}...")
                    elif 'url' in video_info_cache:
                        video_info_cache.pop('path', None)  # 移除本地路径
                        print(f"✅ 缓存中保存CDN URL: {video_info_cache['url'][:100]}...")
                    else:
                        # 如果还没有CDN URL，保留path（上传完成后会更新）
                        print(f"ℹ️ 缓存中保留本地路径，等待CDN上传完成后更新")
                
                self.cache_service.set(
                    video_url=video_url,
                    prompt=prompt,
                    result=cache_result,
                    metadata={'bv_id': video_info['bv_id'], 'title': video_info['title'], 'part_number': part_number}
                )
            
            # 🎬 返回结果时包含播放URL（但不缓存）
            result['video_play_url'] = video_play_url
            if 'video_info' in result:
                result['video_info']['play_url'] = video_play_url
            
            # 后台预加载下一P（异步，不阻塞当前请求）- 仅在启用时执行
            if self.auto_preload_next_part:
                self._preload_next_part(video_url, prompt, part_number)
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Failed to analyze P{part_number}: {error_msg}")
            
            # 🧹 Cleanup on error
            if video_file_path:
                self.cleanup_service.cleanup_file(video_file_path)
            
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
                
                # 🎬 CDN URL已直接保存在缓存中，无需额外检查
                if 'result' in cached_result and 'video_info' in cached_result['result']:
                    video_info = cached_result['result']['video_info']
                    if 'url' in video_info:
                        print(f"✅ 缓存中包含CDN URL: {video_info['url'][:100]}...")
                    elif 'path' in video_info:
                        print(f"ℹ️ 缓存中为本地路径，CDN上传可能尚未完成")
                
                return {
                    'success': True,
                    'from_cache': True,
                    **cached_result
                }
        
        video_file_path = None
        
        try:
            # 🎬 第一步：获取视频直接播放URL（用于前端播放）
            print(f"🎬 获取视频播放地址: {video_info['title']}")
            play_url_result = self.bilibili_service.get_video_play_url(video_url, quality='best')
            
            if not play_url_result.get('success'):
                raise Exception(f"无法获取视频播放地址: {play_url_result.get('error', '未知错误')}")
            
            video_play_url = play_url_result['play_url']
            print(f"✅ 获取到播放地址: {video_play_url[:100]}...")
            
            # 🎵🎬 第二步：并行下载音频和视频
            bv_id = video_info.get('bv_id', 'unknown')
            audio_filename = f"audio_{bv_id}"
            video_filename = f"video_{bv_id}"
            
            print(f"🎵🎬 并行下载音频和视频: {video_info['title']}")
            
            # 🎬 异步处理视频上传到CDN（不阻塞音频分析）
            def upload_video_to_cdn_async(video_file_path: str, bv_id: str, original_video_url: str):
                """异步上传视频到CDN并缓存（单视频，无part_num）"""
                try:
                    # 上传视频到CDN
                    print(f"📤 开始上传视频到CDN: {os.path.basename(video_file_path)}")
                    cdn_url = self.file_upload_service.upload_file(video_file_path, file_key="file0")
                    
                    if cdn_url:
                        print(f"✅ 视频已上传到CDN: {cdn_url[:100]}...")
                        
                        # 🔄 直接更新分析结果缓存，将CDN URL保存到video_info中
                        try:
                            print(f"🔍 [上传完成] 尝试读取分析结果缓存: {original_video_url}")
                            # 尝试读取分析结果缓存
                            analysis_cache = self.cache_service.get(
                                video_url=original_video_url,
                                prompt="提取视频中的知识点",  # 默认prompt
                                max_age_hours=24 * 7
                            )
                            
                            if analysis_cache:
                                print(f"✅ [上传完成] 找到分析结果缓存，准备更新CDN URL")
                                
                                # 更新缓存中的视频URL为CDN URL，移除本地路径
                                updated = False
                                
                                # 1. 更新 result.video_info.url（分析结果中的video_info）
                                if 'result' in analysis_cache and 'video_info' in analysis_cache['result']:
                                    old_url = analysis_cache['result']['video_info'].get('url', '')
                                    analysis_cache['result']['video_info']['url'] = cdn_url
                                    # 移除本地路径（如果存在）
                                    analysis_cache['result']['video_info'].pop('path', None)
                                    updated = True
                                    print(f"✅ [上传完成] 更新 result.video_info.url: {old_url[:50]}... → {cdn_url[:50]}...")
                                
                                # 2. 更新顶层的 video_info.url（如果存在）
                                if 'video_info' in analysis_cache:
                                    old_url = analysis_cache['video_info'].get('url', '')
                                    analysis_cache['video_info']['url'] = cdn_url
                                    analysis_cache['video_info'].pop('path', None)
                                    updated = True
                                    print(f"✅ [上传完成] 更新 video_info.url: {old_url[:50]}... → {cdn_url[:50]}...")
                                
                                if updated:
                                    # 重新保存更新后的缓存
                                    print(f"💾 [上传完成] 保存更新后的缓存...")
                                    self.cache_service.set(
                                        video_url=original_video_url,
                                        prompt="提取视频中的知识点",
                                        result=analysis_cache,
                                        metadata=analysis_cache.get('metadata', {})
                                    )
                                    print(f"✅ [上传完成] 已更新分析结果缓存，CDN URL已保存到video_info: {cdn_url[:100]}...")
                                else:
                                    print(f"⚠️ [上传完成] 缓存结构不匹配，无法更新CDN URL")
                                
                                # 🗑️ 删除临时CDN URL缓存（如果存在）- 单视频没有part_num
                                try:
                                    cache_key = f"pending_cdn_url_{bv_id}"
                                    cache_file = os.path.join(self.cache_service.cache_dir, f"{cache_key}.json")
                                    if os.path.exists(cache_file):
                                        os.remove(cache_file)
                                        print(f"🗑️ 已删除临时CDN URL缓存: {cache_key}")
                                except Exception as e:
                                    pass  # 忽略删除临时文件的错误
                            else:
                                # 🔄 分析结果缓存尚未保存，先保存到临时CDN URL缓存
                                # 这样当分析结果保存时，可以检查并合并CDN URL
                                print(f"ℹ️ [上传完成] 分析结果缓存尚未保存，先保存CDN URL到临时缓存")
                                self._save_pending_cdn_url(original_video_url, cdn_url, bv_id, None)  # 单视频没有part_num
                        except Exception as e:
                            print(f"⚠️ [上传完成] 更新分析结果缓存失败: {str(e)}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"❌ 视频上传到CDN失败")
                    
                    # 清理下载的视频文件
                    self.cleanup_service.cleanup_file(video_file_path)
                    
                except Exception as e:
                    print(f"❌ 视频上传到CDN过程出错: {str(e)}")
                    import traceback
                    traceback.print_exc()
            
            # 使用线程池并行下载
            executor = ThreadPoolExecutor(max_workers=2)
            try:
                audio_future = executor.submit(
                    self.bilibili_service.download_audio,
                    video_url,
                    audio_filename
                )
                video_future = executor.submit(
                    self.bilibili_service.download_video,
                    video_url,
                    video_filename,
                    'best'
                )
                
                # 等待音频下载完成（音频先完成，可以立即开始ASR）
                print(f"⏳ 等待音频下载完成...")
                audio_result = audio_future.result()
                audio_file_path = audio_result['file_path']
                print(f"✅ 音频下载完成: {audio_result.get('file_size', 0) / 1024 / 1024:.2f} MB")
                
                # 音频下载完成后，立即开始ASR分析（不等待视频）
                # 视频下载在后台继续，完成后异步上传到CDN
                
                # 在后台线程中处理视频上传（不阻塞）
                def handle_video_download_and_upload():
                    try:
                        print(f"⏳ 等待视频下载完成...")
                        video_result = video_future.result()
                        video_file_path = video_result['file_path']
                        print(f"✅ 视频下载完成: {video_result.get('file_size', 0) / 1024 / 1024:.2f} MB")
                        
                        # 上传到CDN并缓存
                        upload_video_to_cdn_async(video_file_path, bv_id, video_url)
                    except Exception as e:
                        print(f"❌ 视频下载或上传过程出错: {str(e)}")
                        import traceback
                        traceback.print_exc()
                
                # 在后台线程中执行视频下载完成后的处理（不阻塞）
                self.executor.submit(handle_video_download_and_upload)
                
            finally:
                # 不关闭executor，让视频下载继续在后台进行
                pass
            
            # 使用音频文件进行ASR分析
            video_file_path = audio_file_path
            
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
            
            # 🎬 检查是否有待写入的CDN URL（上传先完成的情况）
            bv_id = video_info.get('bv_id', '')
            pending_cdn_url = self._get_pending_cdn_url(bv_id)
            
            # 🎬 video_info中的url应该存储CDN URL（如果已上传），否则暂时保留原始URL
            video_info_copy = video_info.copy()
            if pending_cdn_url:
                video_info_copy['url'] = pending_cdn_url  # 🎬 优先使用CDN URL
                print(f"✅ 使用待写入的CDN URL更新video_info: {pending_cdn_url[:100]}...")
            
            # Combine results（不保存播放URL到缓存，因为CDN链接有时效性）
            result = {
                'success': True,
                'video_info': video_info_copy,  # 🎬 使用包含CDN URL的video_info
                'analysis': analysis_result,
                'analyzed_at': datetime.now().isoformat(),
                'from_cache': False,
            }
            
            # ⚠️ 移除video_info中的play_url（如果存在）
            if 'play_url' in result['video_info']:
                result['video_info'].pop('play_url')
            
            # 🎬 同时更新analysis.result.video_info中的url（如果存在）
            if 'analysis' in result and 'result' in result['analysis'] and 'video_info' in result['analysis']['result']:
                if pending_cdn_url:
                    result['analysis']['result']['video_info']['url'] = pending_cdn_url
                    result['analysis']['result']['video_info'].pop('path', None)  # 移除本地路径
                    print(f"✅ 使用待写入的CDN URL更新analysis.result.video_info: {pending_cdn_url[:100]}...")
            
            # Step 4: Save to cache（移除播放URL和本地路径，只保存CDN URL）
            if self.use_cache:
                # 创建缓存副本，确保不包含播放URL
                cache_result = result.copy()
                cache_result.pop('video_play_url', None)  # 移除顶层播放URL（如果存在）
                
                # 🎬 移除本地路径，只保留CDN URL（如果已上传）
                if 'analysis' in cache_result and 'result' in cache_result['analysis'] and 'video_info' in cache_result['analysis']['result']:
                    video_info_cache = cache_result['analysis']['result']['video_info']
                    # 优先使用待写入的CDN URL，其次使用已有的url
                    if pending_cdn_url:
                        video_info_cache['url'] = pending_cdn_url
                        video_info_cache.pop('path', None)  # 移除本地路径
                        print(f"✅ 使用待写入的CDN URL: {pending_cdn_url[:100]}...")
                    elif 'url' in video_info_cache:
                        video_info_cache.pop('path', None)  # 移除本地路径
                        print(f"✅ 缓存中保存CDN URL: {video_info_cache['url'][:100]}...")
                    else:
                        # 如果还没有CDN URL，保留path（上传完成后会更新）
                        print(f"ℹ️ 缓存中保留本地路径，等待CDN上传完成后更新")
                
                self.cache_service.set(
                    video_url=video_url,
                    prompt=prompt,
                    result=cache_result,
                    metadata={'bv_id': video_info['bv_id'], 'title': video_info['title']}
                )
            
            # 🎬 返回结果时包含播放URL（但不缓存）
            result['video_play_url'] = video_play_url
            if 'video_info' in result:
                result['video_info']['play_url'] = video_play_url
            
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
            # 🧹 清理下载的音频文件
            if video_file_path:
                self.cleanup_service.cleanup_file(video_file_path)
    
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
        
        # 结果已保存在cache中，不再需要单独保存到batch_results文件夹
        print(f"✅ Job {job_id} completed. Results are cached in cache directory.")
        
        return job

