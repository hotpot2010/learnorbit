"""
快速修复：为指定任务添加 thumbnail_cdn
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask

def fix_thumbnail(task_id: str, cdn_filename: str):
    """为指定任务添加thumbnail_cdn"""
    cdn_url = f"http://file.gsxservice.com/{cdn_filename}"
    
    with get_db_session() as db:
        task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
        
        if not task:
            print(f"❌ 任务不存在: {task_id}")
            return
        
        print(f"📋 找到任务: {task.video_title}")
        print(f"   当前 video_info: {task.video_info}")
        
        # 更新 video_info
        video_info = task.video_info if isinstance(task.video_info, dict) else {}
        video_info['thumbnail_cdn'] = cdn_url
        
        # 如果没有原始thumbnail，也设置一下
        if not video_info.get('thumbnail'):
            video_info['thumbnail'] = 'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
        
        task.video_info = video_info
        db.commit()
        
        print(f"✅ 已更新 thumbnail_cdn: {cdn_url}")
        print(f"   新的 video_info: {task.video_info}")

if __name__ == "__main__":
    # 根据终端输出的文件名
    fix_thumbnail("task_1764906207_1200", "3357661089_j42hrby9.jpg")

