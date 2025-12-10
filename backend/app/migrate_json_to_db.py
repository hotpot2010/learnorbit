"""
将results目录中的JSON文件迁移到数据库
"""
import os
import json
from datetime import datetime
from app.database import get_db_session, test_connection
from app.models.offline_video import OfflineVideoTask


def migrate_json_to_db():
    """将JSON文件迁移到数据库"""
    # 获取results目录路径
    results_dir = os.path.join(os.path.dirname(__file__), "../../results")
    
    if not os.path.exists(results_dir):
        print(f"📁 Results目录不存在: {results_dir}")
        return
    
    # 测试数据库连接
    if not test_connection():
        print("❌ 数据库连接失败，无法迁移数据")
        return
    
    # 查找所有任务JSON文件
    task_files = [f for f in os.listdir(results_dir) if f.endswith('.json') and f.startswith('task_')]
    
    if not task_files:
        print(f"📋 未找到任务JSON文件")
        return
    
    print(f"📋 找到 {len(task_files)} 个任务文件，开始迁移...")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    with get_db_session() as db:
        for task_file in task_files:
            try:
                task_path = os.path.join(results_dir, task_file)
                with open(task_path, 'r', encoding='utf-8') as f:
                    task_data = json.load(f)
                
                task_id = task_data.get('task_id')
                if not task_id:
                    print(f"⚠️ 跳过无效文件 {task_file}: 缺少task_id")
                    skipped_count += 1
                    continue
                
                # 检查数据库中是否已存在
                existing_task = db.query(OfflineVideoTask).filter(
                    OfflineVideoTask.task_id == task_id
                ).first()
                
                if existing_task:
                    print(f"⏭️ 跳过 {task_id}: 数据库中已存在")
                    skipped_count += 1
                    continue
                
                # 创建数据库记录
                db_task = OfflineVideoTask(
                    task_id=task_id,
                    bilibili_url=task_data.get('bilibili_url', ''),
                    video_title=task_data.get('video_title'),
                    steps=task_data.get('steps', {}),
                    video_url=task_data.get('video_url'),
                    asr_result_url=task_data.get('asr_result_url'),
                    knowledge_points_result_url=task_data.get('knowledge_points_result_url'),
                    video_info=task_data.get('video_info', {}),
                    is_series=1 if task_data.get('is_series') else 0,
                    series_parts=task_data.get('series_parts', []),
                    created_at=datetime.fromisoformat(task_data.get('created_at')) if task_data.get('created_at') else datetime.now(),
                    updated_at=datetime.fromisoformat(task_data.get('updated_at')) if task_data.get('updated_at') else datetime.now()
                )
                
                db.add(db_task)
                migrated_count += 1
                print(f"✅ 迁移任务: {task_id} - {task_data.get('video_title', 'N/A')}")
                
            except Exception as e:
                print(f"❌ 迁移文件 {task_file} 失败: {e}")
                error_count += 1
        
        db.commit()
    
    print(f"\n📊 迁移完成:")
    print(f"   ✅ 成功迁移: {migrated_count} 个任务")
    print(f"   ⏭️ 跳过: {skipped_count} 个任务（已存在）")
    print(f"   ❌ 失败: {error_count} 个任务")


if __name__ == "__main__":
    print("🚀 开始迁移JSON文件到数据库...")
    migrate_json_to_db()
    print("✅ 迁移完成！")



