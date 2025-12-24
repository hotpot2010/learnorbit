"""
离线视频任务数据库模型
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, JSON
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import json

Base = declarative_base()


class OfflineVideoTask(Base):
    """离线视频任务表"""
    __tablename__ = 'offline_video_tasks'
    
    task_id = Column(String(100), primary_key=True, comment='任务ID')
    bilibili_url = Column(String(500), nullable=False, comment='B站视频链接')
    video_title = Column(String(500), nullable=True, comment='视频标题')
    
    # 步骤状态（JSON格式存储）
    steps = Column(JSON, nullable=False, comment='步骤状态信息')
    
    # 结果URL（单P视频为字符串，多P视频为JSON数组）
    # 🔧 使用MEDIUMTEXT以支持大量分P的URL列表（最大16MB，足够存储数千个URL）
    video_url = Column(MEDIUMTEXT, nullable=True, comment='视频上传后的URL（单P为字符串，多P为JSON数组）')
    transcoded_video_url = Column(MEDIUMTEXT, nullable=True, comment='转码后的视频URL（单P为字符串，多P为JSON数组）')
    asr_result_url = Column(MEDIUMTEXT, nullable=True, comment='ASR结果文件URL（单P为字符串，多P为JSON数组）')
    knowledge_points_result_url = Column(MEDIUMTEXT, nullable=True, comment='知识点结果文件URL（单P为字符串，多P为JSON数组）')
    screenshots_result_url = Column(MEDIUMTEXT, nullable=True, comment='截图结果文件URL（单P为字符串，多P为JSON数组）')
    exercises_result_url = Column(MEDIUMTEXT, nullable=True, comment='练习结果文件URL（单P为字符串，多P为JSON数组）')
    
    # 视频信息（JSON格式存储）
    video_info = Column(JSON, nullable=True, comment='视频详细信息')
    
    # 系列视频信息
    is_series = Column(Integer, default=0, comment='是否为系列视频 0-否 1-是')
    series_parts = Column(JSON, nullable=True, comment='系列视频分P列表')
    
    # 时间戳
    created_at = Column(DateTime, nullable=False, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        # 解析URL字段（可能是JSON字符串或普通字符串）
        def parse_url_field(url_field):
            if not url_field:
                return None
            if isinstance(url_field, list):
                return url_field
            if isinstance(url_field, str):
                try:
                    if url_field.startswith('['):
                        return json.loads(url_field)
                    return url_field
                except:
                    return url_field
            return url_field
        
        return {
            "task_id": self.task_id,
            "bilibili_url": self.bilibili_url,
            "video_title": self.video_title,
            "steps": self.steps if isinstance(self.steps, dict) else json.loads(self.steps) if self.steps else {},
            "video_url": parse_url_field(self.video_url),
            "transcoded_video_url": parse_url_field(self.transcoded_video_url) if hasattr(self, 'transcoded_video_url') else None,
            "asr_result_url": parse_url_field(self.asr_result_url),
            "knowledge_points_result_url": parse_url_field(self.knowledge_points_result_url),
            "screenshots_result_url": parse_url_field(self.screenshots_result_url) if hasattr(self, 'screenshots_result_url') else None,
            "exercises_result_url": parse_url_field(self.exercises_result_url) if hasattr(self, 'exercises_result_url') else None,
            "video_info": self.video_info if isinstance(self.video_info, dict) else json.loads(self.video_info) if self.video_info else {},
            "is_series": bool(self.is_series),
            "series_parts": self.series_parts if isinstance(self.series_parts, list) else json.loads(self.series_parts) if self.series_parts else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f'<OfflineVideoTask {self.task_id}>'

