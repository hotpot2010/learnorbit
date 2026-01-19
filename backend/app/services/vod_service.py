"""
腾讯云点播（VOD）上传服务
"""
import os
from typing import Optional, Dict, Any
from qcloud_vod.vod_upload_client import VodUploadClient
from qcloud_vod.model import VodUploadRequest
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)


class VodService:
    """腾讯云点播服务"""
    
    def __init__(self):
        """初始化VOD服务"""
        self.secret_id = os.getenv('VOD_SECRET_ID', '')
        self.secret_key = os.getenv('VOD_SECRET_KEY', '')
        self.sub_app_id = int(os.getenv('VOD_SUB_APP_ID', '0'))
        self.region = os.getenv('VOD_REGION', 'ap-beijing')  # 默认北京
        self.procedure = os.getenv('VOD_PROCEDURE', 'LongVideoPreset')  # 转码模板
        
        if not self.secret_id or not self.secret_key:
            logger.warning("VOD配置未完整，云点播功能可能无法使用")
    
    def upload_video(
        self,
        video_file_path: str,
        video_name: Optional[str] = None,
        cover_url: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        上传视频文件到腾讯云点播
        
        Args:
            video_file_path: 本地视频文件路径
            video_name: 视频名称（可选）
            cover_url: 封面图URL（可选，使用数据库中已有的适配封面图）
        
        Returns:
            上传成功返回包含 FileId、MediaUrl 等信息的字典，失败返回 None
        """
        if not self.secret_id or not self.secret_key:
            logger.error("VOD配置不完整，无法上传视频")
            return None
        
        try:
            client = VodUploadClient(self.secret_id, self.secret_key)
            request = VodUploadRequest()
            request.MediaFilePath = video_file_path
            request.SubAppId = self.sub_app_id
            request.Procedure = self.procedure  # 使用转码模板，支持自适应码率
            
            if video_name:
                request.MediaName = video_name
            
            # 设置封面图（如果提供）
            if cover_url:
                request.CoverFilePath = cover_url
            
            logger.info(f"📤 开始上传视频到云点播: {video_file_path}")
            logger.info(f"   区域: {self.region}, 子应用ID: {self.sub_app_id}, 转码模板: {self.procedure}")
            
            response = client.upload(self.region, request)
            
            logger.info(f"✅ 视频上传VOD成功: FileId={response.FileId}, MediaUrl={response.MediaUrl}")
            
            return {
                "file_id": response.FileId,
                "media_url": response.MediaUrl,
                "cover_url": getattr(response, 'CoverUrl', None),
                "region": self.region,
                "response": response
            }
        except Exception as err:
            logger.error(f"❌ 上传视频到云点播失败: {str(err)}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def upload_video_by_url(
        self,
        video_url: str,
        video_name: Optional[str] = None,
        cover_url: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        通过URL拉取上传视频到腾讯云点播（推荐用于已有URL的视频）
        
        Args:
            video_url: 视频URL（如B站、YouTube等）
            video_name: 视频名称（可选）
            cover_url: 封面图URL（可选）
        
        Returns:
            上传成功返回包含 FileId、MediaUrl 等信息的字典，失败返回 None
        """
        if not self.secret_id or not self.secret_key:
            logger.error("VOD配置不完整，无法上传视频")
            return None
        
        try:
            from tencentcloud.common import credential
            from tencentcloud.common.profile.client_profile import ClientProfile
            from tencentcloud.common.profile.http_profile import HttpProfile
            from tencentcloud.vod.v20180717 import vod_client, models
            
            # 实例化认证对象
            cred = credential.Credential(self.secret_id, self.secret_key)
            
            # 实例化http选项
            httpProfile = HttpProfile()
            httpProfile.endpoint = "vod.tencentcloudapi.com"
            
            # 实例化client选项
            clientProfile = ClientProfile()
            clientProfile.httpProfile = httpProfile
            
            # 实例化要请求产品的client对象
            client = vod_client.VodClient(cred, self.region, clientProfile)
            
            # 实例化请求对象
            req = models.PullUploadRequest()
            req.MediaUrl = video_url
            req.SubAppId = self.sub_app_id
            req.Procedure = self.procedure  # 使用转码模板，支持自适应码率
            
            if video_name:
                req.MediaName = video_name
            
            if cover_url:
                req.CoverUrl = cover_url
            
            logger.info(f"📤 开始通过URL拉取上传视频到云点播: {video_url}")
            logger.info(f"   区域: {self.region}, 子应用ID: {self.sub_app_id}, 转码模板: {self.procedure}")
            
            # 调用接口
            resp = client.PullUpload(req)
            
            # 注意：拉取上传是异步操作，响应中只包含TaskId，不包含FileId
            # FileId需要等待任务完成后通过查询任务状态获取
            task_id = resp.TaskId if hasattr(resp, 'TaskId') else None
            
            logger.info(f"✅ 视频拉取上传任务已创建: TaskId={task_id}")
            logger.warning(f"⚠️  注意：拉取上传是异步操作，FileId需要等待任务完成后通过查询任务状态获取")
            
            # 返回TaskId，后续需要通过查询任务状态获取FileId
            return {
                "task_id": task_id,
                "file_id": None,  # 拉取上传是异步的，需要等待任务完成
                "region": self.region,
                "response": resp,
                "is_async": True  # 标记为异步操作
            }
        except Exception as err:
            logger.error(f"❌ 通过URL拉取上传视频到云点播失败: {str(err)}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def query_pull_upload_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        查询拉取上传任务状态
        
        Args:
            task_id: 拉取上传任务ID
        
        Returns:
            任务状态信息，包含FileId（如果任务已完成），失败返回 None
        """
        if not self.secret_id or not self.secret_key:
            logger.error("VOD配置不完整，无法查询任务状态")
            return None
        
        try:
            from tencentcloud.common import credential
            from tencentcloud.common.profile.client_profile import ClientProfile
            from tencentcloud.common.profile.http_profile import HttpProfile
            from tencentcloud.vod.v20180717 import vod_client, models
            
            # 实例化认证对象
            cred = credential.Credential(self.secret_id, self.secret_key)
            
            # 实例化http选项
            httpProfile = HttpProfile()
            httpProfile.endpoint = "vod.tencentcloudapi.com"
            
            # 实例化client选项
            clientProfile = ClientProfile()
            clientProfile.httpProfile = httpProfile
            
            # 实例化要请求产品的client对象
            client = vod_client.VodClient(cred, self.region, clientProfile)
            
            # 实例化请求对象
            req = models.DescribeTaskDetailRequest()
            req.TaskId = task_id
            req.SubAppId = self.sub_app_id
            
            logger.info(f"📋 查询拉取上传任务状态: TaskId={task_id}")
            
            # 调用接口
            resp = client.DescribeTaskDetail(req)
            
            # 解析响应
            task_status = None
            file_id = None
            
            # 根据文档，响应结构是：
            # - Status: 任务状态（WAITING/PROCESSING/FINISH/ABORTED）
            # - TaskType: 任务类型（PullUpload）
            # - PullUploadTask: 拉取上传任务信息（包含FileId）
            
            # 先获取任务状态（在响应顶层）
            if hasattr(resp, 'Status'):
                task_status = resp.Status
            
            # 获取任务类型
            task_type = None
            if hasattr(resp, 'TaskType'):
                task_type = resp.TaskType
            
            logger.info(f"📋 任务类型: {task_type}, 状态: {task_status}")
            
            # 对于拉取上传任务，FileId在PullUploadTask中
            if task_type == "PullUpload" and hasattr(resp, 'PullUploadTask'):
                pull_upload_task = resp.PullUploadTask
                if pull_upload_task:
                    # PullUploadTask.Status 可能包含更详细的状态
                    if hasattr(pull_upload_task, 'Status'):
                        # 如果PullUploadTask有Status，优先使用（可能更准确）
                        pull_status = pull_upload_task.Status
                        if pull_status:
                            task_status = pull_status
                    
                    # 获取FileId
                    if hasattr(pull_upload_task, 'FileId'):
                        file_id = pull_upload_task.FileId
                        logger.info(f"✅ 从PullUploadTask获取FileId: {file_id}")
            
            # 如果还没有获取到状态，尝试从TaskDetail获取（兼容其他任务类型）
            if not task_status and hasattr(resp, 'TaskDetail'):
                task_detail = resp.TaskDetail
                if task_detail and hasattr(task_detail, 'Status'):
                    task_status = task_detail.Status
            
            logger.info(f"✅ 任务状态查询成功: Status={task_status}, FileId={file_id}")
            
            return {
                "task_id": task_id,
                "status": task_status,
                "file_id": file_id,
                "task_type": task_type,
                "response": resp
            }
        except Exception as err:
            logger.error(f"❌ 查询拉取上传任务状态失败: {str(err)}")
            import traceback
            logger.error(traceback.format_exc())
            return None


# 全局实例
vod_service = VodService()
