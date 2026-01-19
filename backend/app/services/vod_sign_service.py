"""
腾讯云点播播放签名生成服务
"""
import os
import time
from typing import Optional
from jose import jwt
import logging

logger = logging.getLogger(__name__)


class VodSignService:
    """腾讯云点播播放签名服务"""
    
    def __init__(self):
        """初始化签名服务"""
        self.play_key = os.getenv('VOD_PLAY_KEY', '')
        self.sub_app_id = int(os.getenv('VOD_SUB_APP_ID', '0'))
        
        if not self.play_key:
            logger.warning("VOD播放密钥未配置，播放签名功能可能无法使用")
    
    def generate_play_sign(
        self,
        file_id: str,
        app_id: Optional[int] = None,
        expire_time: Optional[int] = None
    ) -> Optional[str]:
        """
        生成腾讯云点播播放签名（psign）
        
        Args:
            file_id: 视频文件ID
            app_id: 云点播子应用ID（可选，默认使用配置中的值）
            expire_time: 过期时间（秒，可选，默认不设置过期时间）
        
        Returns:
            播放签名（JWT token），失败返回 None
        """
        if not self.play_key:
            logger.error("VOD播放密钥未配置")
            return None
        
        try:
            app_id = app_id or self.sub_app_id
            
            # 播放的音视频类型：RawAdaptive（未加密的转自适应码流输出）
            AudioVideoType = "RawAdaptive"
            # 允许输出的未加密的自适应码流模板ID（10为标准自适应码流模板）
            RawAdaptiveDefinition = 10
            # 做进度条预览的雪碧图模板ID（10为标准雪碧图模板）
            ImageSpriteDefinition = 10
            
            # 当前时间戳
            CurrentTime = int(time.time())
            
            # 构建JWT payload
            payload = {
                "appId": app_id,
                "fileId": file_id,
                "contentInfo": {
                    "audioVideoType": AudioVideoType,
                    "rawAdaptiveDefinition": RawAdaptiveDefinition,
                    "imageSpriteDefinition": ImageSpriteDefinition
                },
                "currentTimeStamp": CurrentTime
            }
            
            # 如果设置了过期时间，添加到payload
            if expire_time:
                payload["expireTimeStamp"] = CurrentTime + expire_time
            
            # 使用HS256算法生成签名
            signature = jwt.encode(payload, self.play_key, algorithm="HS256")
            
            logger.debug(f"✅ 生成VOD播放签名: appId={app_id}, fileId={file_id}")
            
            return signature
        except Exception as err:
            logger.error(f"❌ 生成VOD播放签名失败: {str(err)}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def generate_play_url(
        self,
        file_id: str,
        app_id: Optional[int] = None,
        expire_time: Optional[int] = None
    ) -> Optional[str]:
        """
        生成带签名的播放URL
        
        Args:
            file_id: 视频文件ID
            app_id: 云点播子应用ID（可选）
            expire_time: 过期时间（秒，可选）
        
        Returns:
            带签名的播放URL，失败返回 None
        """
        signature = self.generate_play_sign(file_id, app_id, expire_time)
        if not signature:
            return None
        
        app_id = app_id or self.sub_app_id
        
        # 构建播放URL（使用云点播播放器）
        # 格式：https://playvod.qcloud.com/{appId}/{fileId}?psign={signature}
        play_url = f"https://playvod.qcloud.com/{app_id}/{file_id}?psign={signature}"
        
        return play_url


# 全局实例
vod_sign_service = VodSignService()
