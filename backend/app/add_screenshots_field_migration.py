"""
数据库迁移脚本：添加screenshots_result_url字段
为offline_video_tasks表添加screenshots_result_url字段
"""
from app.database import engine, test_connection
from sqlalchemy import text

def add_screenshots_field():
    """添加screenshots_result_url字段"""
    
    # 测试连接
    if not test_connection():
        print("❌ 数据库连接失败，请检查配置")
        return False
    
    try:
        with engine.connect() as conn:
            # 检查字段是否已存在
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks'
                AND COLUMN_NAME = 'screenshots_result_url'
            """)
            
            result = conn.execute(check_sql)
            row = result.fetchone()
            
            if row and row[0] > 0:
                print("ℹ️ 字段 screenshots_result_url 已存在，跳过迁移")
                return True
            
            # 添加新字段
            alter_sql = text("""
                ALTER TABLE offline_video_tasks
                ADD COLUMN screenshots_result_url MEDIUMTEXT NULL
                COMMENT '截图结果文件URL（单P为字符串，多P为JSON数组）'
                AFTER knowledge_points_result_url
            """)
            
            conn.execute(alter_sql)
            conn.commit()
            
            print("✅ 成功添加字段 screenshots_result_url")
            return True
            
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始数据库迁移：添加screenshots_result_url字段...")
    
    if add_screenshots_field():
        print("✅ 数据库迁移完成！")
        exit(0)
    else:
        print("❌ 数据库迁移失败！")
        exit(1)




