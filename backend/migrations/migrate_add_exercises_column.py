"""
数据库迁移脚本：添加 exercises_result_url 列
运行方式：python migrations/migrate_add_exercises_column.py
（在 backend 目录下运行）
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db_session
from sqlalchemy import text


def check_column_exists():
    """检查列是否已存在"""
    with get_db_session() as db:
        check_sql = text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'offline_video_tasks' 
            AND COLUMN_NAME = 'exercises_result_url'
        """)
        result = db.execute(check_sql).fetchone()
        count = result[0] if result else 0
        print(f"   检查结果: {'存在' if count > 0 else '不存在'}")
        return count > 0


def add_exercises_column():
    """添加 exercises_result_url 列"""
    try:
        with get_db_session() as db:
            # 先检查 screenshots_result_url 列是否存在
            check_prev_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks' 
                AND COLUMN_NAME = 'screenshots_result_url'
            """)
            prev_result = db.execute(check_prev_sql).fetchone()
            
            if prev_result[0] == 0:
                # screenshots_result_url 不存在，不使用 AFTER 子句
                print("   ℹ️  注意: screenshots_result_url 列不存在，将在末尾添加新列")
                alter_sql = text("""
                    ALTER TABLE offline_video_tasks 
                    ADD COLUMN exercises_result_url MEDIUMTEXT NULL 
                    COMMENT '练习结果文件URL（单P为字符串，多P为JSON数组）'
                """)
            else:
                alter_sql = text("""
                    ALTER TABLE offline_video_tasks 
                    ADD COLUMN exercises_result_url MEDIUMTEXT NULL 
                    COMMENT '练习结果文件URL（单P为字符串，多P为JSON数组）' 
                    AFTER screenshots_result_url
                """)
            
            print(f"   执行 SQL: {alter_sql}")
            db.execute(alter_sql)
            db.commit()
            print("   ✅ SQL 执行并提交成功")
    except Exception as e:
        print(f"   ❌ 执行失败: {e}")
        raise


def verify_column():
    """验证列已添加"""
    with get_db_session() as db:
        # 先查看当前数据库名
        db_name_sql = text("SELECT DATABASE()")
        db_name = db.execute(db_name_sql).fetchone()[0]
        print(f"   当前数据库: {db_name}")
        
        # 查询列信息（不指定数据库名，使用当前数据库）
        verify_sql = text("""
            SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'offline_video_tasks'
            AND COLUMN_NAME = 'exercises_result_url'
        """)
        result = db.execute(verify_sql).fetchone()
        
        if result:
            print(f"✅ 列信息：")
            print(f"   列名: {result[0]}")
            print(f"   数据类型: {result[1]}")
            print(f"   注释: {result[2]}")
            return True
        else:
            # 列出所有列以便调试
            all_columns_sql = text("""
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'offline_video_tasks'
                ORDER BY ORDINAL_POSITION
            """)
            columns = db.execute(all_columns_sql).fetchall()
            print(f"   ❌ 未找到 exercises_result_url 列")
            print(f"   📋 当前表的所有列:")
            for col in columns:
                print(f"      - {col[0]}")
            return False


def main():
    """主函数"""
    print("=" * 60)
    print("🔧 数据库迁移：添加 exercises_result_url 列")
    print("=" * 60)
    
    try:
        # 1. 检查列是否已存在
        print("\n📋 步骤 1/3: 检查列是否已存在...")
        if check_column_exists():
            print("✅ 列 exercises_result_url 已存在，无需迁移")
            return
        
        print("📝 列不存在，需要添加")
        
        # 2. 添加列
        print("\n📋 步骤 2/3: 添加 exercises_result_url 列...")
        add_exercises_column()
        print("✅ 列添加成功")
        
        # 3. 验证
        print("\n📋 步骤 3/3: 验证列已添加...")
        if verify_column():
            print("\n" + "=" * 60)
            print("🎉 数据库迁移成功完成！")
            print("=" * 60)
        else:
            print("\n❌ 验证失败：列未找到")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

