"""
数据库迁移脚本：将 video_url、asr_result_url、knowledge_points_result_url 字段改为 MEDIUMTEXT
用于支持大量分P视频的URL列表
"""
from app.database import engine, test_connection
from sqlalchemy import text

def migrate_to_mediumtext():
    """将URL字段从TEXT改为MEDIUMTEXT"""
    if not test_connection():
        print("❌ 数据库连接失败，请检查配置")
        return False
    
    try:
        with engine.connect() as connection:
            # 检查表是否存在
            result = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'offline_video_tasks'
            """))
            table_exists = result.scalar() > 0
            
            if not table_exists:
                print("⚠️  表 offline_video_tasks 不存在，跳过迁移")
                return True
            
            # 检查字段当前类型
            result = connection.execute(text("""
                SELECT COLUMN_TYPE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'video_url'
            """))
            current_type = result.scalar()
            
            if current_type:
                print(f"📋 当前 video_url 字段类型: {current_type}")
                
                # 如果已经是MEDIUMTEXT，跳过
                if 'mediumtext' in current_type.lower():
                    print("✅ video_url 字段已经是 MEDIUMTEXT，无需迁移")
                else:
                    print("🔄 开始迁移 video_url 字段...")
                    connection.execute(text("""
                        ALTER TABLE offline_video_tasks 
                        MODIFY COLUMN video_url MEDIUMTEXT NULL 
                        COMMENT '视频上传后的URL（单P为字符串，多P为JSON数组）'
                    """))
                    connection.commit()
                    print("✅ video_url 字段已迁移为 MEDIUMTEXT")
            else:
                print("⚠️  未找到 video_url 字段，可能表结构不同")
            
            # 迁移 asr_result_url
            result = connection.execute(text("""
                SELECT COLUMN_TYPE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'asr_result_url'
            """))
            current_type = result.scalar()
            
            if current_type:
                if 'mediumtext' in current_type.lower():
                    print("✅ asr_result_url 字段已经是 MEDIUMTEXT，无需迁移")
                else:
                    print("🔄 开始迁移 asr_result_url 字段...")
                    connection.execute(text("""
                        ALTER TABLE offline_video_tasks 
                        MODIFY COLUMN asr_result_url MEDIUMTEXT NULL 
                        COMMENT 'ASR结果文件URL（单P为字符串，多P为JSON数组）'
                    """))
                    connection.commit()
                    print("✅ asr_result_url 字段已迁移为 MEDIUMTEXT")
            
            # 迁移 knowledge_points_result_url
            result = connection.execute(text("""
                SELECT COLUMN_TYPE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'knowledge_points_result_url'
            """))
            current_type = result.scalar()
            
            if current_type:
                if 'mediumtext' in current_type.lower():
                    print("✅ knowledge_points_result_url 字段已经是 MEDIUMTEXT，无需迁移")
                else:
                    print("🔄 开始迁移 knowledge_points_result_url 字段...")
                    connection.execute(text("""
                        ALTER TABLE offline_video_tasks 
                        MODIFY COLUMN knowledge_points_result_url MEDIUMTEXT NULL 
                        COMMENT '知识点结果文件URL（单P为字符串，多P为JSON数组）'
                    """))
                    connection.commit()
                    print("✅ knowledge_points_result_url 字段已迁移为 MEDIUMTEXT")
            
            print("✅ 数据库迁移完成！")
            return True
            
    except Exception as e:
        print(f"❌ 数据库迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 开始数据库迁移：将URL字段改为MEDIUMTEXT...")
    success = migrate_to_mediumtext()
    if success:
        print("✅ 迁移完成！")
    else:
        print("❌ 迁移失败！")
        exit(1)





