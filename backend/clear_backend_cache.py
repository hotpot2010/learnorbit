"""
清除后端内存缓存
清空 OfflineVideoService 的 tasks_cache
"""
from app.services.offline_video_service import OfflineVideoService
import sys

def clear_backend_cache(task_id: str = None):
    """
    清除后端内存缓存
    
    Args:
        task_id: 如果指定，只清除该任务；否则清除所有任务
    """
    print(f"🧹 清除后端内存缓存")
    print("="*80)
    
    try:
        # 获取服务实例
        service = OfflineVideoService()
        
        # 显示当前缓存状态
        print(f"📊 当前缓存状态:")
        print(f"   缓存任务数: {len(service.tasks_cache)}")
        
        if task_id:
            if task_id in service.tasks_cache:
                print(f"   任务 {task_id}: 存在于缓存中")
                
                # 显示状态
                task = service.tasks_cache[task_id]
                if 'steps' in task and 'screenshots' in task['steps']:
                    screenshot_step = task['steps']['screenshots']
                    print(f"      screenshots.status: {screenshot_step.get('status')}")
                    print(f"      screenshots.progress: {screenshot_step.get('progress')}")
            else:
                print(f"   任务 {task_id}: 不在缓存中")
        
        # 清除缓存
        print(f"\n🧹 清除缓存...")
        if task_id:
            if task_id in service.tasks_cache:
                del service.tasks_cache[task_id]
                print(f"✅ 已清除任务 {task_id} 的缓存")
            else:
                print(f"ℹ️ 任务 {task_id} 不在缓存中，无需清除")
        else:
            service.tasks_cache.clear()
            print(f"✅ 已清除所有任务缓存")
        
        print(f"\n📊 清除后缓存状态:")
        print(f"   缓存任务数: {len(service.tasks_cache)}")
        
        print("\n" + "="*80)
        print("✅ 缓存清除完成!")
        print("\n💡 注意:")
        print("   - 此操作只在当前 Python 进程中生效")
        print("   - 如果后端服务在运行，需要重启才能完全清除")
        print("   - 建议步骤:")
        print("     1. 停止后端服务")
        print("     2. 运行此脚本")
        print("     3. 运行 force_fix_task_status.py")
        print("     4. 重新启动后端服务")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"❌ 清除缓存失败: {e}")
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
    
    print(f"🚀 清除后端缓存工具")
    print(f"   目标任务: {task_id}")
    print()
    
    success = clear_backend_cache(task_id)
    
    if success:
        print("\n✅ 缓存已清除")
        exit(0)
    else:
        print("\n❌ 清除失败")
        exit(1)






