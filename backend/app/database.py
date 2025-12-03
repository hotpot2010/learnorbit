"""
数据库连接配置
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from typing import Generator

# 从环境变量或配置获取数据库连接信息
# 支持从环境变量读取，如果没有则使用默认配置
# 默认配置使用用户提供的MySQL连接信息
# 注意：zeroDateTimeBehavior、characterEncoding、allowMultiQueries 是JDBC参数，SQLAlchemy不支持
# SQLAlchemy使用charset参数即可
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'mysql+pymysql://gt_ai_writing_rw:RTHxZS4qFKIo1DVzp6APjMOJ@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing?charset=utf8mb4'
)

# 创建数据库引擎
# MySQL连接参数配置
mysql_connect_args = {}
if DATABASE_URL.startswith("mysql"):
    mysql_connect_args = {
        "charset": "utf8mb4",
        "connect_timeout": 10,
        # PyMySQL特定参数
        "autocommit": False,
        "sql_mode": "TRADITIONAL",
    }

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,  # 连接前检查连接是否有效
    pool_recycle=3600,   # 1小时后回收连接
    pool_size=5,         # 连接池大小
    max_overflow=10,      # 最大溢出连接数
    echo=False,          # 是否打印SQL语句（生产环境设为False）
    connect_args=mysql_connect_args
)

# 创建Session工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话（依赖注入）
    
    Usage:
        db = next(get_db())
        # 使用db进行数据库操作
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    获取数据库会话（上下文管理器）
    
    Usage:
        with get_db_session() as db:
            # 使用db进行数据库操作
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """初始化数据库（创建表）"""
    from app.models.offline_video import Base
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表创建成功")


def test_connection():
    """测试数据库连接"""
    try:
        from sqlalchemy import text
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            print("✅ 数据库连接成功")
            return True
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

