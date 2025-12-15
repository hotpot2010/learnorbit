"""
强制修复任务状态
彻底清除截图步骤的"执行中"状态，设置为"等待执行"
"""
from app.database import get_db_session, test_connection
from app.models.offline_video import OfflineVideoTask
from sqlalchemy import text
from datetime import datetime
import json
import sys

def force_fix_task_status(task_id: str):
    """
    强制修复任务状态
    
    Args:
        task_id: 任务ID
    """
    print(f"🔧 强制修复任务状态: {task_id}")
    print("="*80)
    
    # 测试数据库连接
    if not test_connection():
        print("❌ 数据库连接失败")
        return False
    
    try:
        with get_db_session() as db:
            # 直接使用 SQL 查询，避免任何缓存
            print("📊 步骤1: 查询数据库中的原始数据...")
            result = db.execute(
                text("SELECT task_id, video_title, steps, screenshots_result_url FROM offline_video_tasks WHERE task_id = :task_id"),
                {"task_id": task_id}
            )
            row = result.fetchone()
            
            if not row:
                print(f"❌ 任务不存在: {task_id}")
                return False
            
            print(f"✅ 找到任务: {row[1]}")
            
            # 解析 steps
            if row[2]:
                if isinstance(row[2], str):
                    steps = json.loads(row[2])
                else:
                    steps = row[2]
            else:
                steps = {}
            
            # 显示当前状态
            print(f"\n📊 当前数据库状态:")
            if 'screenshots' in steps:
                screenshot_step = steps['screenshots']
                print(f"   screenshots.status: {screenshot_step.get('status')}")
                print(f"   screenshots.progress: {screenshot_step.get('progress')}")
                print(f"   screenshots.message: {screenshot_step.get('message')}")
            else:
                print(f"   screenshots: 不存在")
            
            print(f"   screenshots_result_url: {'存在' if row[3] else 'NULL'}")
            
            # 强制重置
            print(f"\n🔧 步骤2: 强制重置 screenshots 步骤...")
            
            # 确保有 screenshots 步骤
            if 'screenshots' not in steps:
                steps['screenshots'] = {}
            
            # 强制设置为 pending
            steps['screenshots'] = {
                "status": "pending",
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            }
            
            steps_json = json.dumps(steps)
            
            # 使用原始 SQL 更新，绕过所有 ORM 缓存
            print(f"🔧 步骤3: 使用原始 SQL 更新数据库...")
            db.execute(
                text("""
                    UPDATE offline_video_tasks 
                    SET 
                        steps = :steps,
                        screenshots_result_url = NULL,
                        updated_at = :updated_at
                    WHERE task_id = :task_id
                """),
                {
                    "steps": steps_json,
                    "updated_at": datetime.now(),
                    "task_id": task_id
                }
            )
            
            db.commit()
            
            # 验证更新
            print(f"\n🔍 步骤4: 验证更新结果...")
            result = db.execute(
                text("SELECT steps, screenshots_result_url FROM offline_video_tasks WHERE task_id = :task_id"),
                {"task_id": task_id}
            )
            row = result.fetchone()
            
            if row[0]:
                if isinstance(row[0], str):
                    updated_steps = json.loads(row[0])
                else:
                    updated_steps = row[0]
                
                if 'screenshots' in updated_steps:
                    screenshot_step = updated_steps['screenshots']
                    print(f"✅ screenshots.status: {screenshot_step.get('status')}")
                    print(f"✅ screenshots.progress: {screenshot_step.get('progress')}")
                    print(f"✅ screenshots.message: {screenshot_step.get('message')}")
            
            print(f"✅ screenshots_result_url: {'存在' if row[1] else 'NULL'}")
            
            print("\n" + "="*80)
            print("✅ 强制修复完成!")
            print("\n💡 接下来的步骤:")
            print("   1. 重启后端服务 (Ctrl+C 然后重新运行)")
            print("   2. 刷新前端页面 (Ctrl+Shift+R 强制刷新)")
            print("   3. 查看任务状态是否变为 '等待执行'")
            print("   4. 如果仍显示 '执行中'，清除浏览器缓存")
            print("="*80)
            
            return True
            
    except Exception as e:
        print(f"❌ 修复失败: {e}")
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
    
    print(f"🚀 强制修复任务状态工具")
    print(f"   任务ID: {task_id}")
    print(f"   方法: 使用原始 SQL 绕过缓存")
    print()
    
    success = force_fix_task_status(task_id)
    
    if success:
        print("\n✅ 修复成功！")
        print("\n⚠️  重要：现在必须:")
        print("   1. 重启后端服务")
        print("   2. 强制刷新前端 (Ctrl+Shift+R)")
        exit(0)
    else:
        print("\n❌ 修复失败")
        exit(1)



