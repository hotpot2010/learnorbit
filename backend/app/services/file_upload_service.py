"""
文件上传服务
用于上传文件到内部存储服务，返回公网可访问的URL
"""
import os
import requests
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
        self.upload_url = f"{proxy_base_url}/upload"
        
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
                
                print(f"📤 Uploading file: {os.path.basename(file_path)}")
                print(f"   File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
                
                response = requests.post(
                    self.upload_url,
                    data=form_data,
                    files=files,
                    timeout=300  # 5分钟超时
                )
                
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
