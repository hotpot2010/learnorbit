"""
重置指定任务的截图步骤状态
清除截图相关的存储和状态，以便重新执行
"""
from app.database import get_db_session, test_connection
from app.models.offline_video import OfflineVideoTask
from datetime import datetime
import json
import sys

def reset_screenshots_step(task_id: str):
    """
    重置指定任务的截图步骤
    
    Args:
        task_id: 任务ID
    """
    print(f"🔄 重置任务的截图步骤: {task_id}")
    print("="*80)
    
    # 测试数据库连接
    if not test_connection():
        print("❌ 数据库连接失败")
        return False
    
    try:
        with get_db_session() as db:
            # 查找任务
            task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
            
            if not task:
                print(f"❌ 任务不存在: {task_id}")
                return False
            
            print(f"✅ 找到任务: {task.video_title}")
            print(f"   是否系列: {task.is_series}")
            
            # 显示当前状态
            print(f"\n📊 当前截图状态:")
            if task.steps:
                if isinstance(task.steps, str):
                    steps = json.loads(task.steps)
                else:
                    steps = task.steps
                
                if 'screenshots' in steps:
                    screenshot_step = steps['screenshots']
                    print(f"   - status: {screenshot_step.get('status')}")
                    print(f"   - progress: {screenshot_step.get('progress')}")
                    print(f"   - message: {screenshot_step.get('message')}")
                    
                    result = screenshot_step.get('result')
                    if result and isinstance(result, dict):
                        result_urls = result.get('result_urls', [])
                        if result_urls:
                            print(f"   - result_urls: {len(result_urls)} 个")
                        part_results = result.get('part_results', [])
                        if part_results:
                            print(f"   - part_results: {len(part_results)} 个")
            
            if task.screenshots_result_url:
                try:
                    if task.screenshots_result_url.startswith('['):
                        urls = json.loads(task.screenshots_result_url)
                        print(f"   - screenshots_result_url: {len(urls)} 个URL")
                    else:
                        print(f"   - screenshots_result_url: 1 个URL")
                except:
                    print(f"   - screenshots_result_url: (无法解析)")
            else:
                print(f"   - screenshots_result_url: None")
            
            # 确认重置
            print(f"\n⚠️  即将执行以下操作:")
            print(f"   1. 清除 screenshots_result_url 字段")
            print(f"   2. 重置 screenshots 步骤状态为 PENDING")
            print(f"   3. 清除 screenshots 步骤的 result、error、message")
            print(f"   4. 重置进度为 0")
            
            confirm = input(f"\n确认重置任务 {task_id} 的截图步骤吗? (yes/no): ")
            if confirm.lower() != 'yes':
                print("❌ 取消重置")
                return False
            
            # 开始重置
            print(f"\n🔄 开始重置...")
            
            # 1. 清除 screenshots_result_url
            print(f"   1. 清除 screenshots_result_url...")
            task.screenshots_result_url = None
            
            # 2. 重置 steps.screenshots
            print(f"   2. 重置 screenshots 步骤状态...")
            if task.steps:
                if isinstance(task.steps, str):
                    steps = json.loads(task.steps)
                else:
                    steps = task.steps
                
                # 确保有 screenshots 步骤
                if 'screenshots' not in steps:
                    steps['screenshots'] = {}
                
                # 重置为初始状态
                steps['screenshots'] = {
                    "status": "pending",
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                }
                
                task.steps = steps
            
            # 3. 更新时间戳
            task.updated_at = datetime.now()
            
            # 4. 提交到数据库
            print(f"   3. 保存到数据库...")
            db.commit()
            
            print(f"\n✅ 重置完成!")
            print(f"   - screenshots_result_url: 已清除")
            print(f"   - screenshots 步骤状态: pending")
            print(f"   - 进度: 0%")
            print(f"   - 消息: 等待执行")
            
            print(f"\n💡 现在可以在前端重新执行截图步骤")
            print("="*80)
            
            return True
            
    except Exception as e:
        print(f"❌ 重置失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # 默认任务ID
    default_task_id = "task_1764906207_1200"
    
    # 从命令行参数获取任务ID
    if len(sys.argv) > 1:
        task_id = sys.argv[1]
    else:
        task_id = default_task_id
    
    print(f"🚀 离线视频任务截图步骤重置工具")
    print(f"   任务ID: {task_id}")
    print()
    
    success = reset_screenshots_step(task_id)
    
    if success:
        print("\n✅ 重置成功！可以重新执行截图步骤了")
        exit(0)
    else:
        print("\n❌ 重置失败")
        exit(1)






