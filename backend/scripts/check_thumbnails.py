"""
使用原始SQL强制更新所有任务的 thumbnail_cdn
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_db_session
from sqlalchemy import text

def main():
    """查询所有任务，显示当前 video_info"""
    print("🔍 检查所有任务的 video_info...")
    print("="*60)
    
    with get_db_session() as db:
        # 查询所有任务
        result = db.execute(text("""
            SELECT task_id, video_title, video_info 
            FROM offline_video_tasks 
            ORDER BY created_at DESC
        """))
        
        tasks = result.fetchall()
        
        print(f"📊 共找到 {len(tasks)} 个任务\n")
        
        for task in tasks:
            task_id = task[0]
            video_title = task[1]
            video_info = task[2]
            
            print(f"📋 任务: {task_id}")
            print(f"   标题: {video_title[:50]}...")
            print(f"   video_info: {video_info}")
            
            # 检查是否有 thumbnail_cdn
            import json
            try:
                info_dict = json.loads(video_info) if isinstance(video_info, str) else video_info
                if 'thumbnail_cdn' in info_dict:
                    print(f"   ✅ thumbnail_cdn: {info_dict['thumbnail_cdn']}")
                else:
                    print(f"   ❌ 缺少 thumbnail_cdn")
            except Exception as e:
                print(f"   ❌ 解析失败: {e}")
            
            print()

if __name__ == "__main__":
    main()

