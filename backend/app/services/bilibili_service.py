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
        
        # 🔧 移除URL中的?p=参数，确保获取整个系列的信息
        # 如果URL包含?p=参数，yt-dlp可能只返回单个分P的信息，导致total_parts为0或1
        base_url = url.split('?')[0] if '?' in url else url
        original_url = url  # 保留原始URL用于缓存键
        
        # 尝试从缓存加载序列信息（使用基础URL作为缓存键）
        if use_cache:
            cached_series = self.series_cache.get_cached_series(base_url)
            if cached_series:
                print(f"✅ 使用缓存的序列信息: {cached_series.get('title', '')[:50]}...")
                return cached_series
        
        print(f"📋 Extracting video info: {base_url}")
        
        # 重试配置
        retry_delays = [2, 5, 10]  # 递增延迟：2秒、5秒、10秒
        
        for attempt in range(max_retries):
            try:
                # 如果是重试，添加延迟
                if attempt > 0:
                    delay = retry_delays[min(attempt - 1, len(retry_delays) - 1)]
                    print(f"🔄 Retry attempt {attempt}/{max_retries} after {delay}s delay...")
                    time.sleep(delay)
                
                # 🔧 优化：优先使用直接连接，失败后再使用代理
                # 第一次尝试：不使用代理，直接连接
                # 后续重试：如果配置了代理且第一次失败，使用代理
                proxy_url = None
                use_proxy_this_attempt = False
                
                # 只有在重试时才考虑使用代理（第一次尝试直接连接）
                if attempt > 0 and self.use_proxy and proxy_service:
                    use_proxy_this_attempt = True
                    print(f"📡 直接连接失败，尝试使用代理...")
                
                if use_proxy_this_attempt:
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
                else:
                    # 第一次尝试，使用直接连接
                    print(f"🌐 Using direct connection (no proxy)")
                
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
                    # 超时配置 - 使用代理时增加超时时间
                    'socket_timeout': 60 if proxy_url else 30,  # 代理连接需要更长时间
                    'retries': 1,  # yt-dlp内部重试设为1，我们手动控制重试
                }
                
                # 如果提供了代理，添加到配置中并禁用SSL验证（代理可能导致SSL错误）
                if proxy_url:
                    ydl_opts['proxy'] = proxy_url
                    ydl_opts['nocheckcertificate'] = True  # 禁用SSL证书验证，避免代理导致的SSL错误
                    print(f"⚠️  SSL certificate verification disabled for proxy connection")
                
                # 🔧 添加进度日志和超时提示
                print(f"⏳ 开始提取视频信息（超时时间: {ydl_opts['socket_timeout']}秒）...")
                if proxy_url:
                    print(f"📡 通过代理连接中，可能需要较长时间...")
                
                start_time = time.time()
                progress_printed = False
                
                # 使用后台线程定期打印进度
                import threading
                stop_progress = threading.Event()
                
                def print_progress():
                    """每10秒打印一次进度"""
                    interval = 10
                    while not stop_progress.is_set():
                        if stop_progress.wait(timeout=interval):
                            break
                        elapsed = time.time() - start_time
                        if elapsed > interval:
                            print(f"⏳ 仍在处理中...（已用时 {int(elapsed)}秒）")
                            nonlocal progress_printed
                            progress_printed = True
                
                progress_thread = threading.Thread(target=print_progress, daemon=True)
                progress_thread.start()
                
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(base_url, download=False)  # 使用基础URL
                    
                    stop_progress.set()
                    elapsed_time = time.time() - start_time
                    print(f"✅ 视频信息提取完成（耗时 {elapsed_time:.1f}秒）")
                except Exception as e:
                    stop_progress.set()
                    elapsed_time = time.time() - start_time
                    if elapsed_time > ydl_opts['socket_timeout']:
                        print(f"⏱️  提取超时（耗时 {elapsed_time:.1f}秒，超过 {ydl_opts['socket_timeout']}秒）")
                    raise
                
                # 检查是否是多P视频
                is_playlist = 'entries' in info
                entries = info.get('entries', [])
                total_parts = len(entries) if is_playlist else 1
                
                # 🔧 修复：如果entries为空但is_playlist为True，可能是单视频被误判
                # 或者URL包含?p=参数导致只返回单个分P
                if is_playlist and total_parts == 0:
                    print(f"⚠️  检测到entries为空，可能是单视频或URL参数问题，尝试重新提取...")
                    # 尝试使用原始URL重新提取（如果原始URL包含?p=参数）
                    if original_url != base_url:
                        try:
                            info_with_p = ydl.extract_info(original_url, download=False)
                            if info_with_p is None:
                                print(f"⚠️  重新提取返回None，跳过")
                            # 如果原始URL返回的是单视频，检查是否有n_entries字段
                            elif 'n_entries' in info_with_p and info_with_p['n_entries'] > 1:
                                total_parts = info_with_p['n_entries']
                                print(f"✅ 从n_entries字段获取到分P数: {total_parts}")
                                # 重新使用基础URL提取完整系列信息
                                new_info = ydl.extract_info(base_url, download=False)
                                if new_info is not None:
                                    info = new_info  # 只在成功时更新info
                                    entries = info.get('entries', [])
                                    total_parts = len(entries) if entries else info_with_p['n_entries']
                                else:
                                    print(f"⚠️  重新提取基础URL返回None，使用n_entries值")
                        except Exception as e:
                            print(f"⚠️  重新提取失败: {e}，继续使用原始info")
                
                # 🔧 额外检查：如果total_parts为0但应该是多P视频，尝试从n_entries获取
                if total_parts == 0 and info is not None and 'n_entries' in info and info['n_entries'] > 1:
                    total_parts = info['n_entries']
                    print(f"✅ 从n_entries字段获取到分P数: {total_parts}")
                    # 如果entries为空，尝试重新提取完整系列
                    if not entries:
                        try:
                            # 强制提取完整播放列表
                            ydl_opts_playlist = ydl_opts.copy()
                            ydl_opts_playlist['noplaylist'] = False
                            with yt_dlp.YoutubeDL(ydl_opts_playlist) as ydl_playlist:
                                new_info = ydl_playlist.extract_info(base_url, download=False)
                            if new_info is not None:
                                info = new_info  # 只在成功时更新info
                                entries = info.get('entries', [])
                                total_parts = len(entries) if entries else total_parts
                            else:
                                print(f"⚠️  强制提取播放列表返回None")
                        except Exception as e:
                            print(f"⚠️  强制提取播放列表失败: {e}，继续使用原始info")
                
                print(f"✅ Successfully extracted video info (attempt {attempt + 1}/{max_retries})")
                print(f"📊 视频信息: is_playlist={is_playlist}, total_parts={total_parts}, entries数量={len(entries)}")
                
                # 🔧 确保info不为None
                if info is None:
                    raise Exception("提取视频信息失败：返回结果为None")
                
                # 如果是单视频，直接返回
                if not is_playlist and total_parts <= 1:
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
                        'url': base_url,  # 使用基础URL
                        'is_series': False,
                        'total_parts': 1,
                        'part_number': 1,
                    }
                    
                    # 缓存单视频信息（使用基础URL作为缓存键）
                    if use_cache:
                        self.series_cache.set_cached_series(base_url, result)
                    
                    return result
                
                # 多P视频：返回序列信息和所有分P信息
                series_title = info.get('title', '')
                parts_info = []
                
                # 🔧 修复：确保entries不为空，如果为空但有total_parts，尝试手动构建
                entries_list = info.get('entries', [])
                if not entries_list and total_parts > 0:
                    print(f"⚠️  entries为空但total_parts={total_parts}，尝试手动构建分P信息...")
                    # 手动构建分P信息（基于total_parts）
                    for idx in range(1, total_parts + 1):
                        parts_info.append({
                            'part_number': idx,
                            'part_title': f'P{idx}',
                            'full_title': f'{series_title} P{idx}',
                            'duration': 0,
                            'url': f"{base_url}?p={idx}",
                            'bv_id': info.get('id', ''),
                        })
                    print(f"✅ 手动构建了 {len(parts_info)} 个分P信息")
                else:
                    # 正常情况：遍历entries
                    for idx, entry in enumerate(entries_list, 1):
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
                                'url': entry.get('url') or entry.get('webpage_url') or f"{base_url}?p={idx}",
                                'bv_id': entry.get('id', ''),
                            })
                    
                    # 🔧 修复：确保total_parts和parts_info一致
                    if total_parts > 0 and len(parts_info) == 0:
                        print(f"⚠️  total_parts={total_parts} 但parts_info为空，使用total_parts作为分P数")
                    elif len(parts_info) > 0 and total_parts != len(parts_info):
                        print(f"⚠️  total_parts={total_parts} 与parts_info长度={len(parts_info)}不一致，使用parts_info长度")
                        total_parts = len(parts_info)
                    
                    result = {
                        'bv_id': info.get('id', ''),
                        'title': series_title,
                        'description': info.get('description', ''),
                        'uploader': info.get('uploader', ''),
                        'upload_date': info.get('upload_date', ''),
                        'view_count': info.get('view_count', 0),
                        'like_count': info.get('like_count', 0),
                        'thumbnail': info.get('thumbnail', ''),
                        'url': base_url,  # 使用基础URL（不包含?p=参数）
                        'is_series': True,
                        'total_parts': total_parts,
                        'series_title': series_title,
                        'parts': parts_info,
                    }
                    
                    # 缓存序列信息（使用基础URL作为缓存键）
                    if use_cache:
                        self.series_cache.set_cached_series(base_url, result)
                    
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
                
                connection_method = "代理" if proxy_url else "直接连接"
                print(f"❌ Attempt {attempt + 1}/{max_retries} failed ({connection_method}): {error_msg[:200]}")
                
                # 如果是SSL错误，记录详细信息
                if 'ssl' in error_lower or 'decryption' in error_lower:
                    print(f"🔒 SSL error detected")
                    if proxy_url:
                        print(f"   当前使用代理: {proxy_url}")
                        print(f"   建议：尝试不同的代理或禁用代理")
                    else:
                        print(f"   直接连接SSL错误，重试时将尝试使用代理")
                
                # 如果使用代理且失败，标记代理为失败并切换
                if proxy_url and self.use_proxy and proxy_service:
                    proxy_service.mark_proxy_failed(proxy_url)
                    print(f"🔄 标记代理为失败，下次重试将尝试下一个代理")
                
                # 如果是直接连接失败且配置了代理，提示下次将使用代理
                if not proxy_url and attempt == 0 and self.use_proxy and is_retryable_error:
                    print(f"💡 直接连接失败，下次重试将尝试使用代理")
                
                # 如果是最后一次尝试，或者不是可重试的错误，抛出异常
                if attempt == max_retries - 1 or not is_retryable_error:
                    print(f"❌ 提取视频信息失败（已尝试 {attempt + 1} 次）")
                    raise Exception(f"Failed to extract video info: {error_msg}")
                
                # 如果是可重试的错误且还有重试机会，继续循环
                print(f"⚠️  检测到可重试错误，将继续重试...")
    
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
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            # Cookie 支持（某些视频可能需要）
            'cookiefile': None,  # 如果需要可以指定 cookie 文件
            # 🔧 修复 FFmpeg 合并错误：优先使用 copy 模式（不重新编码，最快最兼容）
            'postprocessors': [],
            # 优先尝试直接复制流（不重新编码），如果失败再尝试重新编码
            'postprocessor_args': {
                'ffmpeg': [
                    '-c:v', 'copy',    # 直接复制视频流（不重新编码，最快）
                    '-c:a', 'copy',   # 直接复制音频流（不重新编码，最快）
                ],
            },
            # 如果合并失败，允许使用单独的视频或音频文件
            'keepvideo': True,  # 保留原始视频文件
            'keepaudio': True,  # 保留原始音频文件
            # 🎬 多P视频处理：如果URL包含?p=参数，只下载指定的分P
            # 如果URL不包含?p=参数，但检测到是playlist，只下载第一个
            'noplaylist': False,  # 允许playlist，但通过URL参数控制
        }
        
        # 如果URL包含?p=参数，确保只下载指定的分P
        if '?p=' in url or '&p=' in url:
            # 提取p参数值
            import re
            p_match = re.search(r'[?&]p=(\d+)', url)
            if p_match:
                p_number = int(p_match.group(1))
                # 使用playlist_items只下载指定的分P
                ydl_opts['playlist_items'] = str(p_number)
                print(f"🎯 检测到?p={p_number}参数，只下载第{p_number}个分P")
        
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
            
            # 🔧 检查是否是 FFmpeg 合并错误，如果是，尝试使用已下载的文件
            if 'Postprocessing' in error_msg or 'FFmpeg' in error_msg or 'merge' in error_msg.lower():
                print(f"🔍 检测到 FFmpeg 合并错误，尝试查找已下载的文件...")
                
                # 查找可能已下载的视频或音频文件
                base_name = os.path.splitext(output_filename)[0]
                download_dir = self.download_dir
                
                # 查找可能的文件
                potential_files = []
                if os.path.exists(download_dir):
                    for file in os.listdir(download_dir):
                        if base_name in file and not file.endswith('.part'):
                            file_path = os.path.join(download_dir, file)
                            # 检查文件大小（确保不是空文件）
                            if os.path.getsize(file_path) > 1024:  # 至少 1KB
                                potential_files.append(file_path)
                
                if potential_files:
                    # 优先选择 .mp4 文件
                    mp4_files = [f for f in potential_files if f.endswith('.mp4')]
                    if mp4_files:
                        print(f"✅ 找到已下载的 MP4 文件: {mp4_files[0]}")
                        try:
                            # 尝试获取视频信息
                            with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
                                info = ydl.extract_info(url, download=False)
                            
                            return {
                                'success': True,
                                'file_path': mp4_files[0],
                                'file_size': os.path.getsize(mp4_files[0]),
                                'bv_id': info.get('id', ''),
                                'title': info.get('title', ''),
                                'duration': info.get('duration', 0),
                                'url': url,
                                'note': '使用已下载的文件（合并失败但文件可用）',
                            }
                        except Exception as info_error:
                            print(f"⚠️ 无法获取视频信息，但文件存在: {info_error}")
                            # 即使无法获取信息，也返回文件路径
                            return {
                                'success': True,
                                'file_path': mp4_files[0],
                                'file_size': os.path.getsize(mp4_files[0]),
                                'bv_id': '',
                                'title': '',
                                'duration': 0,
                                'url': url,
                                'note': '使用已下载的文件（合并失败但文件可用，无法获取元数据）',
                            }
                    else:
                        # 使用第一个找到的文件
                        print(f"✅ 找到已下载的文件: {potential_files[0]}")
                        return {
                            'success': True,
                            'file_path': potential_files[0],
                            'file_size': os.path.getsize(potential_files[0]),
                            'bv_id': '',
                            'title': '',
                            'duration': 0,
                            'url': url,
                            'note': '使用已下载的文件（合并失败但文件可用）',
                        }
            
            # 尝试多种降级策略（根据诊断结果调整顺序）
            fallback_strategies = [
                ('Strategy 1: Disable merge (separate files)', {
                    'format': format_str,
                    'merge_output_format': None,  # 禁用合并
                    'keepvideo': True,
                    'keepaudio': True,
                }),
                ('Strategy 2: Best video only (no merge)', {
                    'format': 'bestvideo',
                    'merge_output_format': None,
                }),
                ('Strategy 3: Simple best (no merge)', {
                    'format': 'best',
                    'merge_output_format': None,
                }),
                ('Strategy 4: Best audio only', {
                    'format': 'bestaudio',
                }),
                ('Strategy 5: Worst quality', {
                    'format': 'worst',
                }),
                ('Strategy 6: Any format', {
                    'format': None,  # Let yt-dlp decide
                }),
            ]
            
            for strategy_name, strategy_opts in fallback_strategies:
                print(f"🔄 Trying {strategy_name}...")
                
                fallback_opts = {
                    'outtmpl': ydl_opts['outtmpl'],
                    'quiet': False,
                    'no_warnings': False,
                    'retries': 3,
                    'fragment_retries': 3,
                    'skip_unavailable_fragments': True,
                    'socket_timeout': 30,
                    'user_agent': ydl_opts.get('user_agent'),
                    'referer': ydl_opts.get('referer'),
                    'headers': ydl_opts.get('headers'),
                    'keepvideo': True,  # 保留原始文件
                    'keepaudio': True,  # 保留原始文件
                }
                
                # 应用策略选项
                if 'format' in strategy_opts:
                    fallback_opts['format'] = strategy_opts['format']
                if 'merge_output_format' in strategy_opts:
                    fallback_opts['merge_output_format'] = strategy_opts['merge_output_format']
                else:
                    # 默认尝试合并，使用 copy 模式（最兼容）
                    fallback_opts['merge_output_format'] = 'mp4'
                    # 尝试多种编码器策略
                    if 'aac' in error_msg.lower() or 'libfdk_aac' in error_msg.lower():
                        # 如果 aac 有问题，尝试其他编码器
                        fallback_opts['postprocessor_args'] = {
                            'ffmpeg': [
                                '-c:v', 'copy',      # 视频直接复制
                                '-c:a', 'libmp3lame',  # 使用 mp3 编码器（更兼容）
                                '-b:a', '192k',      # 音频比特率
                            ],
                        }
                        # 如果使用 mp3，需要改变输出格式
                        fallback_opts['merge_output_format'] = 'mkv'  # mkv 支持 mp3
                    else:
                        # 默认使用 copy 模式
                        fallback_opts['postprocessor_args'] = {
                            'ffmpeg': ['-c:v', 'copy', '-c:a', 'copy'],
                        }
                    
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

