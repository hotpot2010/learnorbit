"""
YouTube视频服务
用于处理YouTube视频的音频提取和播放URL获取
"""
import os
import sys
import yt_dlp
from typing import Dict, Any, Optional

# 设置Windows控制台编码为UTF-8
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


class YouTubeService:
    """Service for managing YouTube videos"""
    
    def __init__(self):
        print("📺 YouTubeService initialized")
    
    def extract_video_info(self, url: str) -> Dict[str, Any]:
        """
        提取YouTube视频信息（不下载）
        
        Args:
            url: YouTube视频URL
            
        Returns:
            视频信息字典
        """
        print(f"📋 Extracting YouTube video info: {url}")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,  # 需要完整信息
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                video_id = info.get('id', '')
                title = info.get('title', '')
                duration = info.get('duration', 0)
                description = info.get('description', '')
                uploader = info.get('uploader', '')
                view_count = info.get('view_count', 0)
                thumbnail = info.get('thumbnail', '')
                
                # 格式化时长
                hours = duration // 3600
                minutes = (duration % 3600) // 60
                seconds = duration % 60
                duration_str = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
                
                return {
                    'video_id': video_id,
                    'title': title,
                    'description': description,
                    'author': uploader,
                    'duration': duration_str,
                    'duration_seconds': duration,
                    'play': view_count,
                    'cover': thumbnail,
                    'url': url,
                    'is_series': False,  # YouTube单个视频不是系列
                    'video_amount': 1,
                }
        except Exception as e:
            print(f"❌ Error extracting YouTube video info: {e}")
            raise
    
    def get_audio_url(self, url: str) -> str:
        """
        获取YouTube视频的音频URL（不下载文件）
        注意：此方法返回的URL是临时的，ASR服务可能无法访问
        建议使用 download_audio 方法下载后上传
        
        Args:
            url: YouTube视频URL
            
        Returns:
            音频URL字符串
        """
        print(f"🎵 Extracting audio URL from YouTube: {url}")
        
        ydl_opts = {
            'format': 'bestaudio/best',  # 选择最佳音频格式
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # 获取音频URL
                audio_url = info.get('url')
                
                # 如果有多个格式，选择音频格式
                if 'requested_formats' in info:
                    for fmt in info['requested_formats']:
                        if fmt.get('acodec', 'none') != 'none' and fmt.get('vcodec', 'none') == 'none':
                            audio_url = fmt.get('url')
                            break
                
                if not audio_url:
                    raise Exception("无法获取音频URL")
                
                print(f"✅ Audio URL extracted: {audio_url[:100]}...")
                return audio_url
                
        except Exception as e:
            print(f"❌ Error extracting audio URL: {e}")
            raise
    
    def download_audio(self, url: str, output_filename: str) -> Dict[str, Any]:
        """
        下载YouTube视频的音频文件
        
        Args:
            url: YouTube视频URL
            output_filename: 输出文件名（不含扩展名）
            
        Returns:
            包含音频文件路径的字典
        """
        import tempfile
        from pathlib import Path
        
        print(f"🎵 Downloading audio from YouTube: {url}")
        
        # 创建临时目录
        download_dir = tempfile.mkdtemp(prefix='youtube_audio_')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(download_dir, f'{output_filename}.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',  # 转换为M4A格式（ASR服务支持）
                'preferredquality': '192',
            }],
            'socket_timeout': 30,
            'retries': 3,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # 查找下载的音频文件
                video_id = info.get('id', '')
                title = info.get('title', '')
                duration = info.get('duration', 0)
                
                # 查找实际下载的文件（postprocessors会将文件转换为.m4a格式）
                audio_file = None
                # 优先查找.m4a文件（postprocessors转换后的文件）
                m4a_file = os.path.join(download_dir, f'{output_filename}.m4a')
                if os.path.exists(m4a_file):
                    audio_file = m4a_file
                else:
                    # 如果没有找到.m4a文件，查找其他格式的文件
                    for file in os.listdir(download_dir):
                        if file.startswith(output_filename) or video_id in file:
                            audio_file = os.path.join(download_dir, file)
                            break
                
                if not audio_file or not os.path.exists(audio_file):
                    raise FileNotFoundError(f"Audio file not found after download in {download_dir}. Files: {os.listdir(download_dir)}")
                
                print(f"✅ Audio downloaded: {audio_file} (format: {os.path.splitext(audio_file)[1]})")
                
                return {
                    'file_path': audio_file,
                    'file_size': os.path.getsize(audio_file),
                    'video_id': video_id,
                    'title': title,
                    'duration': duration,
                }
                
        except Exception as e:
            print(f"❌ Error downloading audio: {e}")
            raise
    
    def get_video_play_url(self, url: str) -> Dict[str, Any]:
        """
        获取YouTube视频的播放URL（返回YouTube URL本身，前端使用iframe播放）
        
        Args:
            url: YouTube视频URL
            
        Returns:
            包含play_url的字典（play_url就是原始YouTube URL）
        """
        print(f"🎬 Getting YouTube play URL: {url}")
        
        # 提取视频ID
        video_id = self._extract_video_id(url)
        
        # 返回YouTube embed URL（前端使用iframe播放）
        embed_url = f"https://www.youtube.com/embed/{video_id}"
        
        return {
            'success': True,
            'play_url': url,  # 原始URL，前端可以使用
            'embed_url': embed_url,  # iframe embed URL
            'video_id': video_id,
        }
    
    def _extract_video_id(self, url: str) -> str:
        """
        从YouTube URL中提取视频ID
        
        Args:
            url: YouTube视频URL（支持多种格式）
            
        Returns:
            视频ID
        """
        import re
        
        # 匹配各种YouTube URL格式
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        raise ValueError(f"无法从URL中提取视频ID: {url}")


# 创建全局实例
youtube_service = YouTubeService()

