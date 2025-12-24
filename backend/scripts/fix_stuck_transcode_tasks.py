"""
修复卡在执行中状态的转码任务
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
import json
from datetime import datetime

def fix_stuck_transcode_tasks(dry_run=True):
    """
    修复卡在执行中状态但实际已完成的转码任务
    
    Args:
        dry_run: 如果为True，只显示将要修复的任务，不实际修改数据库
    """
    
    print("🔧 修复卡住的转码任务...")
    if dry_run:
        print("⚠️ 当前为预览模式，不会实际修改数据库")
    print("="*60)
    
    with get_db_session() as db:
        # 查询所有任务
        tasks = db.query(OfflineVideoTask).all()
        
        fixed_count = 0
        
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
                    print(f"\n🔧 修复任务: {task.task_id}")
                    print(f"   视频标题: {task.video_title}")
                    print(f"   当前状态: {status} -> success")
                    print(f"   当前进度: {transcode_step.get('progress', 0)}% -> 100%")
                    
                    if not dry_run:
                        # 更新步骤状态
                        steps['transcode']['status'] = 'success'
                        steps['transcode']['progress'] = 100
                        steps['transcode']['message'] = '转码完成'
                        
                        # 如果result为空，设置result
                        if not steps['transcode'].get('result'):
                            # 检查是否是多P视频（JSON数组）
                            if task.transcoded_video_url.startswith('['):
                                urls = json.loads(task.transcoded_video_url)
                                steps['transcode']['result'] = {
                                    'parts': [{'part_number': i, 'status': 'success', 'result_url': url} for i, url in enumerate(urls, 1)],
                                    'total': len(urls),
                                    'success': len(urls),
                                    'failed': 0
                                }
                            else:
                                # 单P视频
                                steps['transcode']['result'] = {
                                    'url': task.transcoded_video_url
                                }
                        
                        # 保存到数据库
                        task.steps = json.dumps(steps, ensure_ascii=False)
                        task.updated_at = datetime.now()
                        db.commit()
                        
                        print("   ✅ 已修复")
                    else:
                        print("   ℹ️ 预览模式：未实际修改")
                    
                    fixed_count += 1
                
            except Exception as e:
                print(f"⚠️ 处理任务 {task.task_id} 时出错: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print("\n" + "="*60)
        if dry_run:
            print(f"📊 预览完成: 发现 {fixed_count} 个需要修复的任务")
            print("💡 运行 `python backend/scripts/fix_stuck_transcode_tasks.py --fix` 来实际修复")
        else:
            print(f"✅ 修复完成: 已修复 {fixed_count} 个任务")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='修复卡住的转码任务')
    parser.add_argument('--fix', action='store_true', help='实际执行修复（默认只预览）')
    args = parser.parse_args()
    
    fix_stuck_transcode_tasks(dry_run=not args.fix)

