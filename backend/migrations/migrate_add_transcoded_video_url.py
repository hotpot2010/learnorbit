"""
数据库迁移脚本：添加 transcoded_video_url 字段
日期: 2024-12-24
说明: 为 offline_video_tasks 表添加转码视频URL字段
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import get_db_session

def migrate():
    """执行迁移"""
    print("开始添加 transcoded_video_url 字段...")
    
    with get_db_session() as db:
        try:
            # 检查字段是否已存在
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'transcoded_video_url'
            """)
            
            result = db.execute(check_sql).fetchone()
            
            if result and result[0] > 0:
                print("✅ 字段 transcoded_video_url 已存在，跳过迁移")
                return
            
            # 添加字段
            alter_sql = text("""
                ALTER TABLE `offline_video_tasks` 
                ADD COLUMN `transcoded_video_url` MEDIUMTEXT NULL 
                COMMENT '转码后的视频URL（单P为字符串，多P为JSON数组）' 
                AFTER `video_url`
            """)
            
            db.execute(alter_sql)
            db.commit()
            
            print("✅ 成功添加 transcoded_video_url 字段")
            
            # 验证
            verify_sql = text("""
                SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'transcoded_video_url'
            """)
            
            result = db.execute(verify_sql).fetchone()
            if result:
                print(f"✅ 验证成功:")
                print(f"   字段名: {result[0]}")
                print(f"   字段类型: {result[1]}")
                print(f"   字段注释: {result[2]}")
            
        except Exception as e:
            print(f"❌ 迁移失败: {str(e)}")
            db.rollback()
            raise

if __name__ == "__main__":
    migrate()

