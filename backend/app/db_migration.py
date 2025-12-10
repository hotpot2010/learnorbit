"""
数据库迁移脚本
用于创建offline_video_tasks表
"""
from app.database import engine, init_db, test_connection

if __name__ == "__main__":
    print("🚀 开始数据库迁移...")
    
    # 测试连接
    if not test_connection():
        print("❌ 数据库连接失败，请检查配置")
        exit(1)
    
    # 创建表
    try:
        init_db()
        print("✅ 数据库迁移完成！")
    except Exception as e:
        print(f"❌ 数据库迁移失败: {e}")
        exit(1)



