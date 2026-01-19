"""
数据库迁移脚本：添加VOD（腾讯云点播）相关字段
日期: 2025-01-16
说明: 为 offline_video_tasks 表添加云点播相关字段
      - vod_file_id: 云点播文件ID
      - vod_play_url: 云点播播放URL（带签名）
      - vod_cover_url: 云点播封面URL
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import get_db_session


def check_column_exists(column_name: str) -> bool:
    """检查列是否已存在"""
    try:
        with get_db_session() as db:
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = :column_name
            """)
            
            result = db.execute(check_sql, {"column_name": column_name}).fetchone()
            return result[0] > 0 if result else False
    except Exception as e:
        print(f"   ❌ 检查列失败: {e}")
        raise


def add_vod_file_id_column():
    """添加 vod_file_id 列"""
    try:
        with get_db_session() as db:
            # 检查 exercises_result_url 列是否存在（作为参考位置）
            check_prev_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'exercises_result_url'
            """)
            prev_result = db.execute(check_prev_sql).fetchone()
            
            if prev_result[0] == 0:
                # exercises_result_url 不存在，检查其他字段
                check_screenshots_sql = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'offline_video_tasks' 
                    AND COLUMN_NAME = 'screenshots_result_url'
                """)
                screenshots_result = db.execute(check_screenshots_sql).fetchone()
                
                if screenshots_result[0] == 0:
                    # 如果都不存在，在 knowledge_points_result_url 之后添加
                    alter_sql = text("""
                        ALTER TABLE offline_video_tasks 
                        ADD COLUMN vod_file_id MEDIUMTEXT NULL 
                        COMMENT '云点播文件ID（单P为字符串，多P为JSON数组）' 
                        AFTER knowledge_points_result_url
                    """)
                else:
                    alter_sql = text("""
                        ALTER TABLE offline_video_tasks 
                        ADD COLUMN vod_file_id MEDIUMTEXT NULL 
                        COMMENT '云点播文件ID（单P为字符串，多P为JSON数组）' 
                        AFTER screenshots_result_url
                    """)
            else:
                alter_sql = text("""
                    ALTER TABLE offline_video_tasks 
                    ADD COLUMN vod_file_id MEDIUMTEXT NULL 
                    COMMENT '云点播文件ID（单P为字符串，多P为JSON数组）' 
                    AFTER exercises_result_url
                """)
            
            print(f"   执行 SQL: {alter_sql}")
            db.execute(alter_sql)
            db.commit()
            print("   ✅ SQL 执行并提交成功")
    except Exception as e:
        print(f"   ❌ 执行失败: {e}")
        raise


def add_vod_play_url_column():
    """添加 vod_play_url 列"""
    try:
        with get_db_session() as db:
            alter_sql = text("""
                ALTER TABLE offline_video_tasks 
                ADD COLUMN vod_play_url MEDIUMTEXT NULL 
                COMMENT '云点播播放URL（单P为字符串，多P为JSON数组，带签名）' 
                AFTER vod_file_id
            """)
            
            print(f"   执行 SQL: {alter_sql}")
            db.execute(alter_sql)
            db.commit()
            print("   ✅ SQL 执行并提交成功")
    except Exception as e:
        print(f"   ❌ 执行失败: {e}")
        raise


def add_vod_cover_url_column():
    """添加 vod_cover_url 列"""
    try:
        with get_db_session() as db:
            alter_sql = text("""
                ALTER TABLE offline_video_tasks 
                ADD COLUMN vod_cover_url VARCHAR(500) NULL 
                COMMENT '云点播封面URL' 
                AFTER vod_play_url
            """)
            
            print(f"   执行 SQL: {alter_sql}")
            db.execute(alter_sql)
            db.commit()
            print("   ✅ SQL 执行并提交成功")
    except Exception as e:
        print(f"   ❌ 执行失败: {e}")
        raise


def verify_columns():
    """验证所有列已添加"""
    try:
        with get_db_session() as db:
            verify_sql = text("""
                SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks'
                AND COLUMN_NAME IN ('vod_file_id', 'vod_play_url', 'vod_cover_url')
                ORDER BY ORDINAL_POSITION
            """)
            
            results = db.execute(verify_sql).fetchall()
            
            if len(results) == 3:
                print("\n   ✅ 验证成功，所有VOD字段已添加:")
                for row in results:
                    print(f"      - {row[0]}: {row[1]} - {row[2]}")
                return True
            else:
                print(f"\n   ❌ 验证失败：期望3个字段，实际找到{len(results)}个")
                if results:
                    print("   找到的字段:")
                    for row in results:
                        print(f"      - {row[0]}")
                return False
    except Exception as e:
        print(f"   ❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("🔧 数据库迁移：添加VOD（腾讯云点播）相关字段")
    print("=" * 60)
    
    try:
        # 1. 检查字段是否已存在
        print("\n📋 步骤 1/4: 检查字段是否已存在...")
        fields_to_check = ['vod_file_id', 'vod_play_url', 'vod_cover_url']
        existing_fields = []
        
        for field in fields_to_check:
            if check_column_exists(field):
                print(f"   ✅ 字段 {field} 已存在")
                existing_fields.append(field)
            else:
                print(f"   📝 字段 {field} 不存在，需要添加")
        
        if len(existing_fields) == len(fields_to_check):
            print("\n✅ 所有VOD字段已存在，无需迁移")
            return
        
        # 2. 添加 vod_file_id 字段
        if 'vod_file_id' not in existing_fields:
            print("\n📋 步骤 2/4: 添加 vod_file_id 字段...")
            add_vod_file_id_column()
            print("✅ 字段添加成功")
        else:
            print("\n📋 步骤 2/4: 跳过 vod_file_id（已存在）")
        
        # 3. 添加 vod_play_url 字段
        if 'vod_play_url' not in existing_fields:
            print("\n📋 步骤 3/4: 添加 vod_play_url 字段...")
            add_vod_play_url_column()
            print("✅ 字段添加成功")
        else:
            print("\n📋 步骤 3/4: 跳过 vod_play_url（已存在）")
        
        # 4. 添加 vod_cover_url 字段
        if 'vod_cover_url' not in existing_fields:
            print("\n📋 步骤 4/4: 添加 vod_cover_url 字段...")
            add_vod_cover_url_column()
            print("✅ 字段添加成功")
        else:
            print("\n📋 步骤 4/4: 跳过 vod_cover_url（已存在）")
        
        # 5. 验证所有字段
        print("\n📋 验证: 检查所有VOD字段...")
        if verify_columns():
            print("\n" + "=" * 60)
            print("🎉 数据库迁移成功完成！")
            print("=" * 60)
        else:
            print("\n❌ 验证失败：部分字段未找到")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
