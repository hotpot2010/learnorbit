"""
检查卡在执行中状态的转码任务
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
import json

def check_stuck_transcode_tasks():
    """检查卡在执行中状态但实际已完成的转码任务"""
    
    print("🔍 检查卡住的转码任务...")
    print("="*60)
    
    with get_db_session() as db:
        # 查询所有任务
        tasks = db.query(OfflineVideoTask).all()
        
        stuck_tasks = []
        
        for task in tasks:
            try:
                # 解析 steps JSON
                steps = json.loads(task.steps) if isinstance(task.steps, str) else task.steps
                
                # 检查是否有 transcode 步骤
                if 'transcode' not in steps:
                    continue
                
                transcode_step = steps['transcode']
                status = transcode_step.get('status', '')
                
                # 检查是否有转码URL（说明转码完成了）但状态还是running
                has_transcoded_url = task.transcoded_video_url is not None and task.transcoded_video_url != ''
                is_running = status == 'running'
                
                if has_transcoded_url and is_running:
                    stuck_tasks.append({
                        'task_id': task.task_id,
                        'video_title': task.video_title,
                        'transcoded_video_url': task.transcoded_video_url,
                        'status': status,
                        'progress': transcode_step.get('progress', 0),
                        'message': transcode_step.get('message', '')
                    })
                    
                    print(f"\n❌ 发现卡住的任务:")
                    print(f"   任务ID: {task.task_id}")
                    print(f"   视频标题: {task.video_title}")
                    print(f"   转码URL: {task.transcoded_video_url[:50]}...")
                    print(f"   当前状态: {status}")
                    print(f"   进度: {transcode_step.get('progress', 0)}%")
                    print(f"   消息: {transcode_step.get('message', '')}")
                
            except Exception as e:
                print(f"⚠️ 处理任务 {task.task_id} 时出错: {e}")
                continue
        
        print("\n" + "="*60)
        print(f"📊 检查完成:")
        print(f"   总任务数: {len(tasks)}")
        print(f"   卡住的转码任务: {len(stuck_tasks)}")
        
        return stuck_tasks

if __name__ == "__main__":
    stuck_tasks = check_stuck_transcode_tasks()
    
    if stuck_tasks:
        print(f"\n⚠️ 发现 {len(stuck_tasks)} 个卡住的转码任务")
        print("💡 运行 fix_stuck_transcode_tasks.py 脚本来修复这些任务")
    else:
        print("\n✅ 没有发现卡住的转码任务")

