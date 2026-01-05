"""
重置所有 offline video 中执行中的子任务
因为有时候程序断掉会保持在执行中状态，需要重置为 pending 以便重新执行
注意：不会影响已经完成的任务（success 或 partial_success）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
import json
from datetime import datetime
from sqlalchemy.orm.attributes import flag_modified
import requests

# 所有可能的步骤类型
STEP_TYPES = [
    'download',
    'transcode',
    'asr',
    'knowledge_points',
    'screenshots',
    'exercises',
    'summary'
]

# 已完成的状态（不会被重置）
COMPLETED_STATUSES = ['success', 'partial_success']

# 需要重置的状态
RUNNING_STATUSES = ['running', 'retrying']


def clear_backend_cache_via_api(backend_url: str = "http://localhost:8000") -> bool:
    """
    通过 API 清除后端缓存
    
    Args:
        backend_url: 后端服务地址
        
    Returns:
        是否成功
    """
    try:
        api_url = f"{backend_url}/open-api/offline-video/cache/clear"
        print(f"\n🧹 通过 API 清除后端缓存...")
        print(f"   API URL: {api_url}")
        
        response = requests.post(api_url, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ {result.get('message', '缓存已清除')}")
            print(f"   清除数量: {result.get('cleared_count', 0)}")
            return True
        else:
            print(f"   ⚠️ API 返回状态码: {response.status_code}")
            print(f"   响应: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"   ⚠️ 无法连接到后端服务 ({backend_url})")
        print(f"   💡 提示: 后端服务可能未运行，或者需要重启后端服务以清除缓存")
        return False
    except Exception as e:
        print(f"   ⚠️ 清除缓存失败: {e}")
        return False


def reset_running_tasks(dry_run=True, clear_cache=True, backend_url: str = "http://localhost:8000"):
    """
    重置所有执行中的子任务状态为 pending
    
    Args:
        dry_run: 如果为True，只显示将要重置的任务，不实际修改数据库
        clear_cache: 是否在重置后清除后端缓存（需要后端服务运行）
        backend_url: 后端服务地址
    """
    
    print("🔧 重置执行中的 offline video 子任务...")
    if dry_run:
        print("⚠️ 当前为预览模式，不会实际修改数据库")
    print("="*80)
    
    with get_db_session() as db:
        # 查询所有任务
        tasks = db.query(OfflineVideoTask).all()
        
        total_tasks = len(tasks)
        tasks_with_running_steps = 0
        total_steps_reset = 0
        
        # 统计每个步骤类型被重置的数量
        step_reset_count = {step: 0 for step in STEP_TYPES}
        
        print(f"\n📊 总共找到 {total_tasks} 个任务\n")
        
        for task in tasks:
            try:
                # 解析 steps JSON
                steps = json.loads(task.steps) if isinstance(task.steps, str) else task.steps
                
                if not isinstance(steps, dict):
                    print(f"⚠️ 任务 {task.task_id} 的 steps 格式不正确，跳过")
                    continue
                
                # 记录这个任务是否有需要重置的步骤
                task_has_running_steps = False
                task_reset_steps = []
                
                # 遍历所有步骤
                for step_name, step_info in steps.items():
                    if not isinstance(step_info, dict):
                        continue
                    
                    status = step_info.get('status', '')
                    
                    # 检查是否是执行中状态
                    if status in RUNNING_STATUSES:
                        # 检查是否已完成（不应该重置）
                        # 注意：这里我们只重置 running/retrying 状态，不重置 success/partial_success
                        task_has_running_steps = True
                        task_reset_steps.append({
                            'step': step_name,
                            'old_status': status,
                            'old_progress': step_info.get('progress', 0),
                            'old_message': step_info.get('message', ''),
                        })
                        
                        if not dry_run:
                            # 重置步骤状态
                            step_info['status'] = 'pending'
                            step_info['progress'] = 0
                            step_info['message'] = '等待执行（已重置）'
                            # 保留 error 信息，但清除 result（如果需要重新执行）
                            # step_info['error'] = None  # 可选：清除错误信息
                            # step_info['result'] = None  # 可选：清除结果
                            
                            # 更新统计
                            if step_name in step_reset_count:
                                step_reset_count[step_name] += 1
                
                # 如果有需要重置的步骤，显示信息并更新数据库
                if task_has_running_steps:
                    tasks_with_running_steps += 1
                    total_steps_reset += len(task_reset_steps)
                    
                    print(f"\n🔧 任务: {task.task_id}")
                    print(f"   视频标题: {task.video_title or 'N/A'}")
                    print(f"   需要重置的步骤数: {len(task_reset_steps)}")
                    
                    for reset_info in task_reset_steps:
                        print(f"   - {reset_info['step']}: {reset_info['old_status']} -> pending")
                        print(f"     进度: {reset_info['old_progress']}% -> 0%")
                        if reset_info['old_message']:
                            print(f"     消息: {reset_info['old_message']}")
                    
                    if not dry_run:
                        # 更新 steps JSON
                        # 使用 flag_modified 确保 SQLAlchemy 检测到 JSON 字段的更改
                        task.steps = steps
                        flag_modified(task, 'steps')
                        task.updated_at = datetime.now()
                        
                        print(f"   ✅ 已重置")
                    else:
                        print(f"   ℹ️ 预览模式：未实际修改")
                
            except Exception as e:
                print(f"⚠️ 处理任务 {task.task_id} 时出错: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # 提交更改
        if not dry_run:
            try:
                db.commit()
                print(f"\n✅ 数据库更改已提交")
            except Exception as e:
                print(f"\n❌ 提交数据库更改失败: {e}")
                db.rollback()
                import traceback
                traceback.print_exc()
        
        # 打印统计信息
        print("\n" + "="*80)
        print("📊 统计信息:")
        print(f"   总任务数: {total_tasks}")
        print(f"   有执行中步骤的任务数: {tasks_with_running_steps}")
        print(f"   总共重置的步骤数: {total_steps_reset}")
        print(f"\n   各步骤类型重置数量:")
        for step_name, count in step_reset_count.items():
            if count > 0:
                print(f"     - {step_name}: {count}")
        
        if dry_run:
            print(f"\n💡 运行 `python backend/scripts/reset_running_tasks.py --fix` 来实际重置")
        else:
            print(f"\n✅ 重置完成！")
            
            # 清除后端缓存（如果启用且后端服务运行）
            if clear_cache:
                cache_cleared = clear_backend_cache_via_api(backend_url)
                if not cache_cleared:
                    print(f"\n⚠️ 注意: 后端缓存清除失败")
                    print(f"   💡 建议:")
                    print(f"      1. 确保后端服务正在运行")
                    print(f"      2. 或者重启后端服务以清除缓存")
                    print(f"      3. 或者在前端刷新页面（前端会从数据库重新加载）")
            else:
                print(f"\n💡 提示: 后端缓存未清除")
                print(f"   💡 建议:")
                print(f"      1. 重启后端服务以清除缓存")
                print(f"      2. 或者在前端刷新页面（前端会从数据库重新加载）")
                print(f"      3. 或者使用 --clear-cache 选项自动清除缓存")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='重置所有执行中的 offline video 子任务')
    parser.add_argument('--fix', action='store_true', help='实际执行重置（默认只预览）')
    parser.add_argument('--clear-cache', action='store_true', default=True, help='重置后清除后端缓存（默认启用）')
    parser.add_argument('--no-clear-cache', dest='clear_cache', action='store_false', help='重置后不清除后端缓存')
    parser.add_argument('--backend-url', default='http://localhost:8000', help='后端服务地址（默认: http://localhost:8000）')
    args = parser.parse_args()
    
    reset_running_tasks(
        dry_run=not args.fix,
        clear_cache=args.clear_cache,
        backend_url=args.backend_url
    )

