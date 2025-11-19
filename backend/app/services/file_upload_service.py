"""
文件上传服务
用于上传文件到内部存储服务，返回公网可访问的URL
"""
import os
import requests
import aiohttp
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
        print(f"📤 File upload service initialized")
        print(f"📍 Upload URL: {self.upload_url}")
    
    def upload_file(self, file_path: str, file_key: str = "file0") -> Optional[str]:
        """
        上传文件到内部存储服务
        
        Args:
            file_path: 本地文件路径
            file_key: 文件字段名，默认为 "file0"
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return None
        
        try:
            # 准备上传表单
            form_data = {"uid": self.uid}
            
            # 打开文件并上传
            with open(file_path, 'rb') as f:
                files = {file_key: (os.path.basename(file_path), f, 'video/mp4')}
                
                file_size_mb = os.path.getsize(file_path) / (1024*1024)
                print(f"📤 Uploading file: {os.path.basename(file_path)}")
                print(f"   File size: {file_size_mb:.2f} MB")
                print(f"   Upload URL: {self.upload_url}")
                print(f"   This may take {int(file_size_mb * 2)} - {int(file_size_mb * 5)} seconds depending on network speed...")
                
                import time
                start_time = time.time()
                
                response = requests.post(
                    self.upload_url,
                    data=form_data,
                    files=files,
                    timeout=300  # 5分钟超时
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
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Upload failed: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error during upload: {e}")
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
        异步上传文件到内部存储服务（用于并行上传）
        
        Args:
            file_path: 本地文件路径
            file_key: 文件字段名，默认为 "file0"
            
        Returns:
            上传成功返回公网URL，失败返回None
        """
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            return None
        
        try:
            file_size_mb = os.path.getsize(file_path) / (1024*1024)
            print(f"📤 [Async] Uploading file: {os.path.basename(file_path)} ({file_size_mb:.2f} MB)")
            
            import time
            start_time = time.time()
            
            # 使用 aiohttp 进行异步上传
            form_data = aiohttp.FormData()
            form_data.add_field('uid', self.uid)
            
            with open(file_path, 'rb') as f:
                form_data.add_field(
                    file_key,
                    f,
                    filename=os.path.basename(file_path),
                    content_type='video/mp4'
                )
                
                timeout = aiohttp.ClientTimeout(total=300)  # 5分钟超时
                
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(self.upload_url, data=form_data) as response:
                        upload_time = time.time() - start_time
                        print(f"✅ [Async] Upload completed in {upload_time:.1f}s ({file_size_mb/upload_time:.2f} MB/s)")
                        
                        if response.status != 200:
                            error_text = await response.text()
                            print(f"❌ Upload failed with status {response.status}: {error_text}")
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
                        
                        print(f"❌ No valid URL in response")
                        return None
                        
        except Exception as e:
            print(f"❌ [Async] Upload failed: {e}")
            import traceback
            traceback.print_exc()
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
