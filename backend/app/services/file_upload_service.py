"""
文件上传服务
用于上传文件到内部存储服务，返回公网可访问的URL
"""
import os
import requests
import aiohttp
import asyncio
import time
from typing import Optional


class FileUploadService:
    """文件上传服务类"""
    
    def __init__(self):
        """初始化文件上传服务"""
        # 使用转发服务
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        # 转发服务地址（默认本地，生产环境可通过环境变量配置）
        proxy_base_url = os.getenv('API_PROXY_URL', 'http://localhost:8001')
        self.upload_url = f"{proxy_base_url}/open-api/upload"
        
        # 文件访问基础URL（内部存储服务返回相对路径时使用）
        self.base_url = "http://file.gsxservice.com/"
        self.uid = "20210716"
        
        # 上传配置
        self.max_retries = 3  # 最大重试次数
        self.base_timeout = 600  # 基础超时时间（10分钟）
        self.max_timeout = 1800  # 最大超时时间（30分钟）
        self.retry_delays = [2, 5, 10]  # 重试延迟（秒），指数退避
        
        print(f"📤 File upload service initialized")
        print(f"📍 Upload URL: {self.upload_url}")
        print(f"⚙️  Upload config: max_retries={self.max_retries}, base_timeout={self.base_timeout}s, max_timeout={self.max_timeout}s")
    
    def _calculate_timeout(self, file_size_mb: float) -> int:
        """
        根据文件大小动态计算超时时间
        
        Args:
            file_size_mb: 文件大小（MB）
            
        Returns:
            超时时间（秒）
        """
        # 基础超时 + 文件大小 * 每MB需要的秒数（假设网络速度较慢时每MB需要10秒）
        calculated_timeout = int(self.base_timeout + file_size_mb * 10)
        # 不超过最大超时时间
        return min(calculated_timeout, self.max_timeout)
    
    def upload_file(self, file_path: str, file_key: str = "file0", content_type: Optional[str] = None) -> Optional[str]:
        """
        上传文件到内部存储服务（带重试机制）
        
        Args:
            file_path: 本地文件路径
            file_key: 文件字段名，默认为 "file0"
            content_type: 文件MIME类型，如果不指定则根据文件扩展名自动检测
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return None
        
        file_size_mb = os.path.getsize(file_path) / (1024*1024)
        timeout = self._calculate_timeout(file_size_mb)
        
        # 根据文件扩展名自动检测content-type
        if not content_type:
            file_ext = os.path.splitext(file_path)[1].lower()
            content_type_map = {
                '.txt': 'text/plain; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.mp4': 'video/mp4',
                '.mp3': 'audio/mpeg',
                '.pdf': 'application/pdf',
            }
            content_type = content_type_map.get(file_ext, 'application/octet-stream')
        
        print(f"📤 Uploading file: {os.path.basename(file_path)}")
        print(f"   File size: {file_size_mb:.2f} MB")
        print(f"   Content-Type: {content_type}")
        print(f"   Upload URL: {self.upload_url}")
        print(f"   Timeout: {timeout}s ({timeout//60}min {timeout%60}s)")
        print(f"   Max retries: {self.max_retries}")
        
        # 重试循环
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                if attempt > 1:
                    delay = self.retry_delays[min(attempt - 2, len(self.retry_delays) - 1)]
                    print(f"🔄 Retry attempt {attempt}/{self.max_retries} after {delay}s delay...")
                    time.sleep(delay)
                
                # 准备上传表单
                form_data = {"uid": self.uid}
                
                # 打开文件并上传
                with open(file_path, 'rb') as f:
                    files = {file_key: (os.path.basename(file_path), f, content_type)}
                    
                    start_time = time.time()
                    
                    response = requests.post(
                        self.upload_url,
                        data=form_data,
                        files=files,
                        timeout=timeout
                    )
                    
                    upload_time = time.time() - start_time
                    print(f"✅ Upload completed in {upload_time:.1f}s ({file_size_mb/upload_time:.2f} MB/s)")
                    
                    response.raise_for_status()
                    
                    # 解析响应
                    result = response.json()
                    print(f"📦 Upload response: {result}")
                    
                    if 'files' in result and len(result['files']) > 0:
                        # 查找对应的文件
                        for file_info in result['files']:
                            if file_info.get('key') == file_key:
                                relative_url = file_info.get('url', '')
                                
                                # 构建完整URL
                                if relative_url:
                                    # 如果返回的是相对路径，添加base_url
                                    if not relative_url.startswith('http'):
                                        full_url = self.base_url + relative_url
                                    else:
                                        full_url = relative_url
                                    
                                    print(f"✅ File uploaded successfully: {full_url}")
                                    return full_url
                    
                    print(f"❌ No valid URL in response")
                    last_error = "No valid URL in response"
                    
            except requests.exceptions.Timeout as e:
                last_error = f"Timeout after {timeout}s: {str(e)}"
                print(f"⏱️  Upload timeout (attempt {attempt}/{self.max_retries}): {last_error}")
                if attempt < self.max_retries:
                    # 超时后增加超时时间
                    timeout = min(int(timeout * 1.5), self.max_timeout)
                    print(f"   Increasing timeout to {timeout}s for next retry")
                    
            except requests.exceptions.RequestException as e:
                last_error = f"Request error: {str(e)}"
                print(f"❌ Upload failed (attempt {attempt}/{self.max_retries}): {last_error}")
                
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                print(f"❌ Unexpected error during upload (attempt {attempt}/{self.max_retries}): {last_error}")
                import traceback
                traceback.print_exc()
        
        print(f"❌ Upload failed after {self.max_retries} attempts. Last error: {last_error}")
        return None
    
    def upload_video_for_asr(self, local_video_path: str) -> Optional[str]:
        """
        上传视频文件用于ASR识别
        
        Args:
            local_video_path: 本地视频文件路径
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        print(f"🎬 Uploading video for ASR: {local_video_path}")
        return self.upload_file(local_video_path, file_key="file0")
    
    async def upload_file_async(self, file_path: str, file_key: str = "file0") -> Optional[str]:
        """
        异步上传文件到内部存储服务（用于并行上传，带重试机制）
        
        Args:
            file_path: 本地文件路径
            file_key: 文件字段名，默认为 "file0"
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        if not os.path.exists(file_path):
            print(f"❌ [Async] File not found: {file_path}")
            return None
        
        file_size_mb = os.path.getsize(file_path) / (1024*1024)
        timeout = self._calculate_timeout(file_size_mb)
        
        print(f"📤 [Async] Uploading file: {os.path.basename(file_path)} ({file_size_mb:.2f} MB)")
        print(f"   [Async] Timeout: {timeout}s ({timeout//60}min {timeout%60}s)")
        print(f"   [Async] Max retries: {self.max_retries}")
        
        # 重试循环
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                if attempt > 1:
                    delay = self.retry_delays[min(attempt - 2, len(self.retry_delays) - 1)]
                    print(f"🔄 [Async] Retry attempt {attempt}/{self.max_retries} after {delay}s delay...")
                    await asyncio.sleep(delay)
                
                start_time = time.time()
                
                # 使用 aiohttp 进行异步上传
                form_data = aiohttp.FormData()
                form_data.add_field('uid', self.uid)
                
                # 读取文件内容到内存（避免文件流问题）
                with open(file_path, 'rb') as f:
                    file_content = f.read()
                
                # 根据文件扩展名自动检测content-type
                file_ext = os.path.splitext(file_path)[1].lower()
                content_type_map = {
                    '.txt': 'text/plain; charset=utf-8',
                    '.json': 'application/json; charset=utf-8',
                    '.mp4': 'video/mp4',
                    '.mp3': 'audio/mpeg',
                    '.pdf': 'application/pdf',
                }
                detected_content_type = content_type_map.get(file_ext, 'application/octet-stream')
                
                form_data.add_field(
                    file_key,
                    file_content,
                    filename=os.path.basename(file_path),
                    content_type=detected_content_type
                )
                
                client_timeout = aiohttp.ClientTimeout(
                    total=timeout,
                    connect=60,  # 连接超时60秒
                    sock_read=timeout  # 读取超时
                )
                
                async with aiohttp.ClientSession(timeout=client_timeout) as session:
                    async with session.post(self.upload_url, data=form_data) as response:
                        upload_time = time.time() - start_time
                        print(f"✅ [Async] Upload completed in {upload_time:.1f}s ({file_size_mb/upload_time:.2f} MB/s)")
                        
                        if response.status != 200:
                            error_text = await response.text()
                            last_error = f"Status {response.status}: {error_text}"
                            print(f"❌ [Async] Upload failed with status {response.status}: {error_text}")
                            if attempt < self.max_retries:
                                continue
                            return None
                        
                        result = await response.json()
                        print(f"📦 [Async] Upload response: {result}")
                        
                        if 'files' in result and len(result['files']) > 0:
                            for file_info in result['files']:
                                if file_info.get('key') == file_key:
                                    file_url = file_info.get('url')
                                    if file_url:
                                        if not file_url.startswith(('http://', 'https://')):
                                            file_url = self.base_url + file_url.lstrip('/')
                                        print(f"✅ [Async] File uploaded: {file_url}")
                                        return file_url
                        
                        last_error = "No valid URL in response"
                        print(f"❌ [Async] No valid URL in response")
                        if attempt < self.max_retries:
                            continue
                        return None
                        
            except asyncio.TimeoutError as e:
                last_error = f"Timeout after {timeout}s: {str(e)}"
                print(f"⏱️  [Async] Upload timeout (attempt {attempt}/{self.max_retries}): {last_error}")
                if attempt < self.max_retries:
                    # 超时后增加超时时间
                    timeout = min(int(timeout * 1.5), self.max_timeout)
                    print(f"   [Async] Increasing timeout to {timeout}s for next retry")
                    
            except aiohttp.ClientError as e:
                last_error = f"Client error: {str(e)}"
                print(f"❌ [Async] Upload failed (attempt {attempt}/{self.max_retries}): {last_error}")
                
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                print(f"❌ [Async] Unexpected error during upload (attempt {attempt}/{self.max_retries}): {last_error}")
                import traceback
                traceback.print_exc()
        
        print(f"❌ [Async] Upload failed after {self.max_retries} attempts. Last error: {last_error}")
        return None
    
    async def upload_video_for_asr_async(self, local_video_path: str) -> Optional[str]:
        """
        异步上传视频文件用于ASR识别
        
        Args:
            local_video_path: 本地视频文件路径
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        print(f"🎬 [Async] Uploading video for ASR: {local_video_path}")
        return await self.upload_file_async(local_video_path, file_key="file0")
