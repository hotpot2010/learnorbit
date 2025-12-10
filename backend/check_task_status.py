"""
检查任务的截图状态
"""
from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
import json

task_id = "task_1764906207_1200"

print(f"🔍 检查任务: {task_id}")
print("="*80)

try:
    with get_db_session() as db:
        task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
        
        if not task:
            print(f"❌ 任务不存在: {task_id}")
            exit(1)
        
        print(f"📋 任务信息:")
        print(f"  - 标题: {task.video_title}")
        print(f"  - 创建时间: {task.created_at}")
        print(f"  - 更新时间: {task.updated_at}")
        print(f"  - 是否系列: {task.is_series}")
        
        print(f"\n📊 截图相关字段:")
        print(f"  - screenshots_result_url: {task.screenshots_result_url[:100] if task.screenshots_result_url else 'None'}...")
        
        if task.screenshots_result_url:
            # 尝试解析URL
            try:
                if task.screenshots_result_url.startswith('['):
                    urls = json.loads(task.screenshots_result_url)
                    print(f"  - URL数量: {len(urls)}")
                    print(f"  - 前3个URL:")
                    for i, url in enumerate(urls[:3], 1):
                        print(f"      {i}. {url[:80]}...")
                else:
                    print(f"  - 单个URL: {task.screenshots_result_url}")
            except Exception as e:
                print(f"  - 解析失败: {e}")
        
        print(f"\n🔄 步骤状态:")
        if task.steps:
            if isinstance(task.steps, str):
                steps = json.loads(task.steps)
            else:
                steps = task.steps
            
            for step_key in ['download', 'asr', 'knowledge_points', 'screenshots']:
                if step_key in steps:
                    step_info = steps[step_key]
                    print(f"\n  {step_key}:")
                    print(f"    - status: {step_info.get('status')}")
                    print(f"    - progress: {step_info.get('progress')}")
                    print(f"    - message: {step_info.get('message')}")
                    
                    result = step_info.get('result')
                    if result:
                        print(f"    - result:")
                        if isinstance(result, dict):
                            for k, v in result.items():
                                if k == 'result_urls' and isinstance(v, list):
                                    print(f"        {k}: {len(v)} 个URL")
                                elif k == 'part_results' and isinstance(v, list):
                                    print(f"        {k}: {len(v)} 个分P结果")
                                    # 统计成功和失败的分P
                                    success_count = sum(1 for r in v if r.get('result_url'))
                                    fail_count = len(v) - success_count
                                    print(f"            成功: {success_count}, 失败: {fail_count}")
                                else:
                                    print(f"        {k}: {v}")
                        else:
                            print(f"        {result}")
                    
                    error = step_info.get('error')
                    if error:
                        print(f"    - error: {error}")
        
        print("\n" + "="*80)
        print("✅ 检查完成")
        
except Exception as e:
    print(f"❌ 检查失败: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

