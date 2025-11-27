from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from src.models import Base
from log import logger
# Database setup
# DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./site.db')
# engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
DATABASE_URL = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:2uW6aIDoOq1FX3yiUd8950B7ExVmA4NR@sfo1.clusters.zeabur.com:31095/zeabur')
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"charset": "utf8mb4"} if DATABASE_URL.startswith("mysql") else {}
)

# 测试数据库连接
try:
    with engine.connect() as connection:
        logger.info(f"✅ 数据库连接成功！")
        logger.info(f"数据库类型: {'MySQL' if DATABASE_URL.startswith('mysql') else 'SQLite'}")
        logger.info(f"数据库地址: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'local'}")
except Exception as e:
    logger.error(f"❌ 数据库连接失败: {str(e)}")
    raise

Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()


def create_app():
    app = FastAPI(title="AI Learning Platform")
    
    # 获取当前文件的目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(current_dir, "static")
    templates_dir = os.path.join(current_dir, "..", "templates")
    
    # Mount static files with absolute path
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    # Setup templates with absolute path
    templates = Jinja2Templates(directory=templates_dir)
    
    # Import and include routes
    from .routes import router
    app.include_router(router)
    
    # Store templates in app state for access in routes
    app.state.templates = templates
    
    return app 

__all__ = ['create_app']