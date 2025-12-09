"""
直接更新数据库中的 thumbnail_cdn 字段
使用 SQLAlchemy 直接操作
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
from sqlalchemy import text

def main():
    task_id = "task_1764906207_1200"
    cdn_url = "http://file.gsxservice.com/3357661089_j42hrby9.jpg"
    
    print(f"🔧 正在更新任务 {task_id} 的封面URL...")
    print(f"   CDN URL: {cdn_url}")
    
    with get_db_session() as db:
        # 方式1：使用ORM
        task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
        
        if not task:
            print(f"❌ 任务不存在: {task_id}")
            return
        
        print(f"✅ 找到任务: {task.video_title}")
        print(f"   当前 video_info 类型: {type(task.video_info)}")
        print(f"   当前 video_info: {task.video_info}")
        
        # 获取 video_info
        import json
        if isinstance(task.video_info, str):
            video_info = json.loads(task.video_info)
        elif isinstance(task.video_info, dict):
            video_info = task.video_info.copy()
        else:
            video_info = {}
        
        # 更新字段
        video_info['thumbnail_cdn'] = cdn_url
        
        # 如果没有thumbnail，也添加一个占位
        if not video_info.get('thumbnail'):
            # 从B站API获取
            bv_id = video_info.get('bv_id', 'BV1qE411H7Uv')
            video_info['thumbnail'] = f"https://i0.hdslb.com/bfs/archive/{bv_id}.jpg"
        
        print(f"📝 新的 video_info: {video_info}")
        
        # 更新数据库
        task.video_info = video_info
        db.commit()
        
        print(f"✅ 更新成功！")
        
        # 验证更新
        db.refresh(task)
        print(f"✅ 验证 - video_info: {task.video_info}")
        
        # 检查 thumbnail_cdn 是否存在
        final_info = task.video_info if isinstance(task.video_info, dict) else json.loads(task.video_info)
        if 'thumbnail_cdn' in final_info:
            print(f"✅ thumbnail_cdn 字段已存在: {final_info['thumbnail_cdn']}")
        else:
            print(f"❌ thumbnail_cdn 字段不存在！")

if __name__ == "__main__":
    main()

