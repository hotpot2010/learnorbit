"""
鏂囦欢涓婁紶鏈嶅姟
鐢ㄤ簬灏嗘湰鍦版枃浠朵笂浼犲埌鍏綉鍙闂殑瀛樺偍鏈嶅姟
"""
import os
import requests
import json
from typing import Optional

UPLOAD_URL = "http://internal-storage.genshuixue.com/webupload.php"
UPLOAD_UID = "20210716"
FILE_BASE_URL = "http://file.gsxservice.com/"


class FileUploadService:
    def __init__(self, upload_url: str = UPLOAD_URL, uid: str = UPLOAD_UID, base_url: str = FILE_BASE_URL):
        self.upload_url = upload_url
        self.uid = uid
        self.base_url = base_url
        print(f"FileUploadService initialized")
        print(f"Base URL: {self.base_url}")
    
    def upload_file(self, file_path: str, file_key: str = "file0"):
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return None
        
        try:
            filename = os.path.basename(file_path)
            mime_type = self._get_mime_type(file_path)
            
            print(f"Uploading file: {filename}")
            
            form = {"uid": self.uid}
            
            with open(file_path, 'rb') as f:
                files = {file_key: (filename, f, mime_type)}
                response = requests.post(self.upload_url, data=form, files=files, timeout=300)
            
            print(f"Upload response: {response.text}")
            
            if response.status_code == 200:
                result = json.loads(response.text)
                if "files" in result:
                    for file_info in result["files"]:
                        if file_info.get("key") == file_key:
                            relative_url = file_info.get("url")
                            full_url = self.base_url + relative_url
                            print(f"File uploaded (relative): {relative_url}")
                            print(f"Full URL: {full_url}")
                            return full_url
                return None
            else:
                print(f"Upload failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Upload exception: {e}")
            return None
    
    def upload_video_for_asr(self, video_path: str):
        print(f"Uploading video for ASR: {video_path}")
        return self.upload_file(video_path, file_key="file0")
    
    def _get_mime_type(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
            '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv', '.webm': 'video/webm',
            '.mkv': 'video/x-matroska', '.m4v': 'video/x-m4v', '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav', '.m4a': 'audio/mp4',
        }
        return mime_types.get(ext, 'application/octet-stream')
