"""
Bilibili video download and management service
"""
import os
import sys
import json
import yt_dlp
import tempfile
from typing import Dict, Any, List, Optional
from pathlib import Path
import time

# 设置Windows控制台编码为UTF-8
# 注意：在某些环境下重新包装 stdout/stderr 会导致 "I/O operation on closed file" 错误
# 因此这里完全禁用该操作，使用系统默认编码
# if sys.platform == 'win32':
#     try:
#         import io
#         # 检查流是否已关闭，避免 "I/O operation on closed file" 错误
#         if hasattr(sys.stdout, 'buffer'):
#             try:
#                 # 仅在流可用且未关闭时重新包装
#                 if not getattr(sys.stdout.buffer, 'closed', True):
#                     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
#             except (ValueError, AttributeError, OSError):
#                 pass
#         if hasattr(sys.stderr, 'buffer'):
#             try:
#                 if not getattr(sys.stderr.buffer, 'closed', True):
#                     sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
#             except (ValueError, AttributeError, OSError):
#                 pass
#     except Exception:
#         pass

from .series_cache_service import SeriesCacheService

# 导入代理服务
try:
    from .proxy_service import proxy_service
    PROXY_SERVICE_AVAILABLE = True
except ImportError:
    PROXY_SERVICE_AVAILABLE = False
    proxy_service = None


class BilibiliService:
    """Service for downloading and managing Bilibili videos"""
    
    def __init__(self, download_dir: Optional[str] = None):
        """
        Initialize Bilibili service
        
        Args:
            download_dir: Directory to store downloaded files (defaults to backend/downloads)
        """
        # 使用后端专用下载文件夹，而非系统temp目录
        if download_dir is None:
            # 获取backend目录的绝对路径
            backend_dir = Path(__file__).parent.parent.parent
            download_dir = backend_dir / 'downloads'
        
        self.download_dir = str(download_dir)
        os.makedirs(self.download_dir, exist_ok=True)
        
        # Initialize series cache service
        self.series_cache = SeriesCacheService()
        
        # 代理服务支持
        self.use_proxy = PROXY_SERVICE_AVAILABLE
        
        print(f"📁 Download directory: {self.download_dir}")
        if self.use_proxy:
            print(f"✅ Proxy service enabled for Bilibili requests")
    
    def get_video_play_url(self, url: str, quality: str = 'best') -> Dict[str, Any]:
        """
        Get direct play URL for Bilibili video without downloading
        
        Args:
            url: Bilibili video URL or BV number
            quality: Video quality - 'best', '1080p', '720p', '480p', '360p'
            
        Returns:
            Dictionary with play_url, title, duration, etc.
        """
        # Convert BV number to full URL if needed
        if url.startswith('BV'):
            url = f'https://www.bilibili.com/video/{url}'
        
        print(f"🎬 获取视频播放地址: {url} (Quality: {quality})")
        
        # 根据清晰度生成format字符串
        format_str = self._get_format_string(quality)
        
        ydl_opts = {
            'format': format_str,
            'quiet': True,
            'no_warnings': True,
            # B站特定配置
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.bilibili.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            'socket_timeout': 30,
            'retries': 3,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # 获取直接播放URL
                play_url = info.get('url')
                
                # 如果format包含多个流，需要选择video流
                if 'requested_formats' in info:
                    # 合并了视频和音频流的情况
                    for fmt in info['requested_formats']:
                        if fmt.get('vcodec', 'none') != 'none':
                            play_url = fmt.get('url')
                            break
                
                if not play_url:
                    raise Exception("无法获取视频播放地址")
                
                print(f"✅ 获取到播放地址: {play_url[:100]}...")
                
                return {
                    'success': True,
                    'play_url': play_url,
                    'title': info.get('title', ''),
                    'duration': info.get('duration', 0),
                    'bv_id': info.get('id', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'format': info.get('format', ''),
                    'width': info.get('width', 0),
                    'height': info.get('height', 0),
                    'filesize': info.get('filesize', 0),
                }
        except Exception as e:
            print(f"❌ 获取播放地址失败: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_format_string(self, quality: str) -> str:
        """
        Generate format string based on quality selection
        
        Args:
            quality: Quality level ('best', '1080p', '720p', '480p', '360p', 'audio')
            
        Returns:
            Format string for yt-dlp
        """
        quality_formats = {
            'best': (
                'best[ext=mp4]/'  # 优先：单一流
                'best/'
                'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/'
                'bestvideo/bestaudio'
            ),
            '1080p': (
                'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/'
                'bestvideo[height<=1080]+bestaudio/'
                'best[height<=1080]/'
                'bestvideo[height<=1080]/'
                'best'
            ),
            '720p': (
                'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/'
                'bestvideo[height<=720]+bestaudio/'
                'best[height<=720]/'
                'bestvideo[height<=720]/'
                'best'
            ),
            '480p': (
                'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/'
                'bestvideo[height<=480]+bestaudio/'
                'best[height<=480]/'
                'bestvideo[height<=480]/'
                'best'
            ),
            '360p': (
                'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/'
                'bestvideo[height<=360]+bestaudio/'
                'best[height<=360]/'
                'bestvideo[height<=360]/'
                'worst'
            ),
            'audio': 'bestaudio/best',
        }
        
        return quality_formats.get(quality, quality_formats['best'])
    
    def list_available_formats(self, url: str) -> List[Dict[str, Any]]:
        """
        List all available formats for a video (for debugging)
        
        Args:
            url: Bilibili video URL or BV number
            
        Returns:
            List of available formats
        """
        if url.startswith('BV'):
            url = f'https://www.bilibili.com/video/{url}'
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                if 'formats' in info:
                    formats = []
                    for fmt in info['formats']:
                        formats.append({
                            'format_id': fmt.get('format_id', ''),
                            'ext': fmt.get('ext', ''),
                            'resolution': fmt.get('resolution', 'N/A'),
                            'filesize': fmt.get('filesize', 0),
                            'vcodec': fmt.get('vcodec', 'none'),
                            'acodec': fmt.get('acodec', 'none'),
                        })
                    return formats
                
                return []
        except Exception as e:
            print(f"⚠️ Failed to list formats: {str(e)}")
            return []
    
    def extract_video_info(self, url: str, use_cache: bool = True, max_retries: int = 3) -> Dict[str, Any]:
        """
        Extract video information without downloading
        
        Args:
            url: Bilibili video URL or BV number
            use_cache: Whether to use cached series info
            max_retries: Maximum number of retries for HTTP 412 errors
            
        Returns:
            Video information dictionary
        """
        # Convert BV number to full URL if needed
        if url.startswith('BV'):
            url = f'https://www.bilibili.com/video/{url}'
        
        # 尝试从缓存加载序列信息
        if use_cache:
            cached_series = self.series_cache.get_cached_series(url)
            if cached_series:
                print(f"✅ 使用缓存的序列信息: {cached_series.get('title', '')[:50]}...")
                return cached_series
        
        print(f"📋 Extracting video info: {url}")
        
        # 重试配置
        retry_delays = [2, 5, 10]  # 递增延迟：2秒、5秒、10秒
        
        for attempt in range(max_retries):
            try:
                # 如果是重试，添加延迟
                if attempt > 0:
                    delay = retry_delays[min(attempt - 1, len(retry_delays) - 1)]
                    print(f"🔄 Retry attempt {attempt}/{max_retries} after {delay}s delay...")
                    time.sleep(delay)
                
                # 如果使用代理，获取代理IP（同步方式）
                proxy_url = None
                if self.use_proxy and proxy_service:
                    try:
                        import asyncio
                        # 尝试获取当前事件循环
                        try:
                            loop = asyncio.get_event_loop()
                            if loop.is_running():
                                # 如果事件循环正在运行，创建新的事件循环在后台线程中运行
                                import concurrent.futures
                                import threading
                                
                                def get_proxy_sync():
                                    new_loop = asyncio.new_event_loop()
                                    asyncio.set_event_loop(new_loop)
                                    try:
                                        # 第一次尝试时测试连接，重试时不测试以加快速度
                                        test_conn = (attempt == 0)
                                        return new_loop.run_until_complete(
                                            proxy_service.get_next_proxy(
                                                mark_failed=(attempt > 0),
                                                test_connection=test_conn
                                            )
                                        )
                                    finally:
                                        new_loop.close()
                                
                                with concurrent.futures.ThreadPoolExecutor() as executor:
                                    future = executor.submit(get_proxy_sync)
                                    proxy_url = future.result(timeout=30)  # 增加超时时间以允许代理测试
                            else:
                                # 第一次尝试时测试连接，重试时不测试以加快速度
                                test_conn = (attempt == 0)
                                proxy_url = loop.run_until_complete(
                                    proxy_service.get_next_proxy(
                                        mark_failed=(attempt > 0),
                                        test_connection=test_conn
                                    )
                                )
                        except RuntimeError:
                            # 没有事件循环，创建新的
                            test_conn = (attempt == 0)
                            proxy_url = asyncio.run(
                                proxy_service.get_next_proxy(
                                    mark_failed=(attempt > 0),
                                    test_connection=test_conn
                                )
                            )
                    except Exception as e:
                        # 如果获取代理失败，使用当前代理或直接连接
                        print(f"⚠️  Failed to get proxy: {e}, trying direct connection")
                        proxy_url = None  # 不使用代理，直接连接
                    
                    if proxy_url:
                        print(f"🌐 Using proxy: {proxy_url}")
                    else:
                        print(f"⚠️  No proxy available, using direct connection")
                
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                    # B站特定配置 - 增强请求头以避免412错误
                    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'referer': 'https://www.bilibili.com/',
                    'headers': {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Cache-Control': 'max-age=0',
                    },
                    # 重试配置
                    'socket_timeout': 30,
                    'retries': 1,  # yt-dlp内部重试设为1，我们手动控制重试
                }
                
                # 如果提供了代理，添加到配置中并禁用SSL验证（代理可能导致SSL错误）
                if proxy_url:
                    ydl_opts['proxy'] = proxy_url
                    ydl_opts['nocheckcertificate'] = True  # 禁用SSL证书验证，避免代理导致的SSL错误
                    print(f"⚠️  SSL certificate verification disabled for proxy connection")
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                
                    # 检查是否是多P视频
                    is_playlist = 'entries' in info
                    total_parts = len(info.get('entries', [])) if is_playlist else 1
                    
                    print(f"✅ Successfully extracted video info (attempt {attempt + 1}/{max_retries})")
                    
                    # 如果是单视频，直接返回
                    if not is_playlist:
                        result = {
                            'bv_id': info.get('id', ''),
                            'title': info.get('title', ''),
                            'description': info.get('description', ''),
                            'duration': info.get('duration', 0),
                            'uploader': info.get('uploader', ''),
                            'upload_date': info.get('upload_date', ''),
                            'view_count': info.get('view_count', 0),
                            'like_count': info.get('like_count', 0),
                            'thumbnail': info.get('thumbnail', ''),
                            'url': url,
                            'is_series': False,
                            'total_parts': 1,
                            'part_number': 1,
                        }
                        
                        # 缓存单视频信息
                        if use_cache:
                            self.series_cache.set_cached_series(url, result)
                        
                        return result
                    
                    # 多P视频：返回序列信息和所有分P信息
                    series_title = info.get('title', '')
                    parts_info = []
                    
                    for idx, entry in enumerate(info.get('entries', []), 1):
                        full_title = entry.get('title', f'P{idx}')
                        
                        # 提取分P小标题（去除系列标题）
                        # B站格式通常是: "系列标题 pXX 小标题" 或 "系列标题 小标题"
                        part_title = full_title
                        
                        # 尝试按 " p" 分割（注意小写p，B站格式）
                        if ' p' in full_title.lower():
                            parts = full_title.split(' p', 1)
                            if len(parts) > 1:
                                # 取 "pXX 小标题" 部分，再去掉 "pXX "
                                after_p = parts[1]
                                # 去掉数字和空格，只保留小标题
                                import re
                                part_title = re.sub(r'^\d+\s+', '', after_p).strip()
                        
                        # 如果提取失败或为空，使用完整标题
                        if not part_title:
                            part_title = full_title
                        
                        parts_info.append({
                            'part_number': idx,
                            'part_title': part_title,
                            'full_title': full_title,  # 保留完整标题供参考
                            'duration': entry.get('duration', 0),
                            'url': entry.get('url') or entry.get('webpage_url') or f"{url}?p={idx}",
                            'bv_id': entry.get('id', ''),
                        })
                    
                    result = {
                        'bv_id': info.get('id', ''),
                        'title': series_title,
                        'description': info.get('description', ''),
                        'uploader': info.get('uploader', ''),
                        'upload_date': info.get('upload_date', ''),
                        'view_count': info.get('view_count', 0),
                        'like_count': info.get('like_count', 0),
                        'thumbnail': info.get('thumbnail', ''),
                        'url': url,
                        'is_series': True,
                        'total_parts': total_parts,
                        'series_title': series_title,
                        'parts': parts_info,
                    }
                    
                    # 缓存序列信息
                    if use_cache:
                        self.series_cache.set_cached_series(url, result)
                    
                    return result
                    
            except Exception as e:
                error_msg = str(e)
                error_lower = error_msg.lower()
                
                # 检查是否是 HTTP 412 错误、SSL错误、代理连接错误或其他可重试的错误
                is_retryable_error = (
                    '412' in error_msg or 
                    'precondition failed' in error_lower or
                    'http error' in error_lower or
                    'temporary failure' in error_lower or
                    'connection' in error_lower or
                    'ssl' in error_lower or
                    'decryption' in error_lower or
                    'bad record mac' in error_lower or
                    'proxy' in error_lower or
                    'timeout' in error_lower or
                    'connect' in error_lower or
                    'unable to connect' in error_lower
                )
                
                print(f"❌ Attempt {attempt + 1}/{max_retries} failed: {error_msg}")
                
                # 如果是SSL错误，记录详细信息
                if 'ssl' in error_lower or 'decryption' in error_lower:
                    print(f"🔒 SSL error detected, this may be caused by proxy incompatibility")
                    if proxy_url:
                        print(f"   Current proxy: {proxy_url}")
                        print(f"   Suggestion: Try disabling proxy or use a different proxy")
                
                # 如果使用代理且失败，标记代理为失败并切换
                if self.use_proxy and proxy_service and proxy_url:
                    proxy_service.mark_proxy_failed(proxy_url)
                    print(f"🔄 Marked proxy as failed, will try next proxy on retry")
                
                # 如果是最后一次尝试，或者不是可重试的错误，抛出异常
                if attempt == max_retries - 1 or not is_retryable_error:
                    print(f"❌ Failed to extract video info after {attempt + 1} attempts")
                    raise Exception(f"Failed to extract video info: {error_msg}")
                
                # 如果是可重试的错误且还有重试机会，继续循环
                print(f"⚠️  Retryable error detected, will retry...")
    
    def download_audio(self, url: str, output_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Download only audio from Bilibili video (for ASR)
        
        Args:
            url: Bilibili video URL or BV number
            output_filename: Custom output filename (without extension)
            
        Returns:
            Dictionary with download info including file path
        """
        # Convert BV number to full URL if needed
        if url.startswith('BV'):
            url = f'https://www.bilibili.com/video/{url}'
        
        # Generate output filename
        if not output_filename:
            output_filename = f"bilibili_audio_{int(time.time())}"
        
        output_path = os.path.join(self.download_dir, f"{output_filename}.%(ext)s")
        
        ydl_opts = {
            'format': 'bestaudio/best',  # 🎵 只下载音频
            'outtmpl': output_path,
            'quiet': False,
            'no_warnings': False,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',  # 使用M4A格式（B站原生音频格式）
                'preferredquality': '192',
            }],
            # B站特定配置
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.bilibili.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            'socket_timeout': 30,
            'retries': 3,
        }
        
        try:
            print(f"🎵 Downloading audio from: {url}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # 音频文件路径（yt-dlp会自动添加.m4a扩展名）
                base_filename = os.path.join(self.download_dir, output_filename)
                audio_file = f"{base_filename}.m4a"
                
                # 🔍 查找实际下载的文件
                if not os.path.exists(audio_file):
                    print(f"⚠️ Expected audio file not found: {audio_file}")
                    print(f"🔍 Searching in: {self.download_dir}")
                    
                    # 搜索可能的音频文件
                    for ext in ['.m4a', '.mp3', '.opus', '.webm', '.aac']:
                        potential_file = f"{base_filename}{ext}"
                        if os.path.exists(potential_file):
                            audio_file = potential_file
                            print(f"✅ Found audio file: {audio_file}")
                            break
                    
                    # 如果还是没找到，搜索目录中的文件
                    if not os.path.exists(audio_file):
                        for file in os.listdir(self.download_dir):
                            if output_filename in file and any(file.endswith(ext) for ext in ['.m4a', '.mp3', '.opus', '.webm', '.aac']):
                                audio_file = os.path.join(self.download_dir, file)
                                print(f"✅ Found audio file: {audio_file}")
                                break
                
                if not os.path.exists(audio_file):
                    raise FileNotFoundError(f"Audio file not found after download: {audio_file}")
                
                print(f"✅ Audio downloaded: {audio_file}")
                
                # 提取分P信息（如果有）
                part_number = info.get('playlist_index', 1)
                total_parts = info.get('n_entries', 1)
                
                return {
                    'success': True,
                    'file_path': audio_file,
                    'file_size': os.path.getsize(audio_file),
                    'bv_id': info.get('id', ''),
                    'title': info.get('title', ''),
                    'duration': info.get('duration', 0),
                    'url': url,
                    'part_number': part_number,
                    'total_parts': total_parts,
                    'is_audio_only': True,
                }
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Audio download failed: {error_msg}")
            raise Exception(f"Failed to download audio: {error_msg}")
    
    def download_video(self, url: str, output_filename: Optional[str] = None, quality: str = 'best') -> Dict[str, Any]:
        """
        Download Bilibili video
        
        Args:
            url: Bilibili video URL or BV number
            output_filename: Custom output filename (without extension)
            quality: Video quality - 'best', '1080p', '720p', '480p', '360p', or 'audio'
            
        Returns:
            Dictionary with download info including file path
        """
        # Convert BV number to full URL if needed
        if url.startswith('BV'):
            url = f'https://www.bilibili.com/video/{url}'
        
        # 多P视频检测已移至 batch_analyzer.py 以避免重复请求
        # 如果直接调用此方法且是多P视频，会在下载时自动处理
        
        # Generate output filename
        if not output_filename:
            output_filename = f"bilibili_{int(time.time())}"
        
        output_path = os.path.join(self.download_dir, f"{output_filename}.%(ext)s")
        
        # 根据清晰度选择format字符串
        format_str = self._get_format_string(quality)
        print(f"🎬 选择清晰度: {quality}, format: {format_str}")
        
        ydl_opts = {
            'format': format_str,
            'outtmpl': output_path,
            'quiet': False,
            'no_warnings': False,
            # B站特定配置
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.bilibili.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            # 重试配置
            'socket_timeout': 30,
            'retries': 3,
            'merge_output_format': 'mp4',  # 如果合并，输出 mp4
            # 错误处理和重试
            'retries': 3,
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            # 网络设置
            'socket_timeout': 30,
            # Cookie 支持（某些视频可能需要）
            'cookiefile': None,  # 如果需要可以指定 cookie 文件
        }
        
        try:
            print(f"📥 Downloading video from: {url}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # Get actual downloaded file path
                downloaded_file = ydl.prepare_filename(info)
                
                # 🔍 增强文件查找逻辑
                if not os.path.exists(downloaded_file):
                    print(f"⚠️  Expected file not found: {downloaded_file}")
                    print(f"🔍 Searching for downloaded file in: {self.download_dir}")
                    
                    # 尝试查找实际下载的文件
                    base_name = os.path.splitext(os.path.basename(downloaded_file))[0]
                    found_file = None
                    
                    # 搜索下载目录
                    if os.path.exists(self.download_dir):
                        for file in os.listdir(self.download_dir):
                            if base_name in file:
                                found_file = os.path.join(self.download_dir, file)
                                print(f"✅ Found: {found_file}")
                                break
                    
                    if found_file and os.path.exists(found_file):
                        downloaded_file = found_file
                    else:
                        raise FileNotFoundError(
                            f"Downloaded file not found. Expected: {downloaded_file}, "
                            f"Searched in: {self.download_dir}"
                        )
                
                # 提取分P信息（如果有）
                part_number = info.get('playlist_index', 1)
                total_parts = info.get('n_entries', 1)
                series_title = info.get('playlist_title', info.get('title', ''))
                
                return {
                    'success': True,
                    'file_path': downloaded_file,
                    'file_size': os.path.getsize(downloaded_file),
                    'bv_id': info.get('id', ''),
                    'title': info.get('title', ''),
                    'duration': info.get('duration', 0),
                    'url': url,
                    'part_number': part_number,
                    'total_parts': total_parts,
                    'series_title': series_title,
                    'is_series': total_parts > 1,
                }
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Download failed with primary format: {error_msg}")
            
            # 尝试多种降级策略（根据诊断结果调整顺序）
            fallback_strategies = [
                ('Strategy 1: Best video only', {'format': 'bestvideo'}),  # 某些视频只有这个
                ('Strategy 2: Simple best', {'format': 'best'}),
                ('Strategy 3: Best audio only', {'format': 'bestaudio'}),
                ('Strategy 4: Worst quality', {'format': 'worst'}),
                ('Strategy 5: Any format', {'format': None}),  # Let yt-dlp decide
            ]
            
            for strategy_name, format_opts in fallback_strategies:
                if 'Requested format is not available' in error_msg or 'format' in error_msg.lower():
                    print(f"🔄 Trying {strategy_name}...")
                    
                    fallback_opts = {
                        'outtmpl': ydl_opts['outtmpl'],
                        'quiet': False,
                        'no_warnings': False,
                        'retries': 3,
                        'fragment_retries': 3,
                        'skip_unavailable_fragments': True,
                        'socket_timeout': 30,
                    }
                    
                    # Add format if specified
                    if format_opts.get('format'):
                        fallback_opts['format'] = format_opts['format']
                    
                    try:
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                            info = ydl.extract_info(url, download=True)
                            downloaded_file = ydl.prepare_filename(info)
                            
                            # 🔍 增强文件查找逻辑
                            if not os.path.exists(downloaded_file):
                                print(f"⚠️  File not found: {downloaded_file}")
                                print(f"🔍 Searching in: {self.download_dir}")
                                
                                # 方法1: 尝试不同扩展名
                                base_path = os.path.splitext(downloaded_file)[0]
                                for ext in ['.mp4', '.flv', '.webm', '.mkv', '.m4a', '.mp3', '.part']:
                                    potential_file = base_path + ext
                                    if os.path.exists(potential_file):
                                        downloaded_file = potential_file
                                        print(f"✅ Found with extension: {downloaded_file}")
                                        break
                                
                                # 方法2: 搜索下载目录中的所有文件
                                if not os.path.exists(downloaded_file):
                                    base_name = os.path.splitext(os.path.basename(downloaded_file))[0]
                                    if os.path.exists(self.download_dir):
                                        for file in os.listdir(self.download_dir):
                                            if base_name in file and not file.endswith('.part'):
                                                downloaded_file = os.path.join(self.download_dir, file)
                                                print(f"✅ Found in directory: {downloaded_file}")
                                                break
                            
                            if os.path.exists(downloaded_file):
                                print(f"✅ Download succeeded with {strategy_name}")
                                
                                return {
                                    'success': True,
                                    'file_path': downloaded_file,
                                    'file_size': os.path.getsize(downloaded_file),
                                    'bv_id': info.get('id', ''),
                                    'title': info.get('title', ''),
                                    'duration': info.get('duration', 0),
                                    'url': url,
                                    'download_strategy': strategy_name,
                                }
                            else:
                                print(f"❌ File not found after download (searched: {downloaded_file})")
                                continue
                                
                    except Exception as fallback_error:
                        print(f"❌ {strategy_name} failed: {str(fallback_error)}")
                        continue
            
            # All strategies failed
            raise Exception(
                f"Failed to download video after trying all strategies. "
                f"This video might require authentication (Cookie), be region-locked, "
                f"or have DRM protection. Original error: {error_msg}"
            )
    
    def download_playlist(self, url: str) -> List[Dict[str, Any]]:
        """
        Download all videos from a Bilibili playlist/series
        
        Args:
            url: Bilibili playlist URL
            
        Returns:
            List of download results
        """
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,  # Only get playlist info first
        }
        
        results = []
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                playlist_info = ydl.extract_info(url, download=False)
                
                # Check if it's a playlist
                if 'entries' not in playlist_info:
                    # Single video, treat as single item
                    result = self.download_video(url)
                    return [result]
                
                # Download each video in playlist
                for idx, entry in enumerate(playlist_info['entries'], 1):
                    video_url = entry.get('url') or entry.get('webpage_url')
                    video_id = entry.get('id', f'video_{idx}')
                    
                    try:
                        print(f"📥 Downloading video {idx}/{len(playlist_info['entries'])}: {video_id}")
                        result = self.download_video(video_url, output_filename=f"playlist_{video_id}")
                        result['playlist_index'] = idx
                        results.append(result)
                    except Exception as e:
                        print(f"❌ Failed to download video {idx}: {str(e)}")
                        results.append({
                            'success': False,
                            'error': str(e),
                            'url': video_url,
                            'playlist_index': idx,
                        })
                
                return results
        except Exception as e:
            raise Exception(f"Failed to process playlist: {str(e)}")
    
    def cleanup_video(self, file_path: str):
        """
        Remove downloaded video file
        
        Args:
            file_path: Path to video file
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️ Cleaned up: {file_path}")
        except Exception as e:
            print(f"⚠️ Failed to cleanup {file_path}: {str(e)}")

