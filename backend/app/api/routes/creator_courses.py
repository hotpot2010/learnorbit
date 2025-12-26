"""
创作者课程 API
统一处理前端的创作者课程相关数据库操作
访问公司 MySQL 数据库（learnorbit_creator_courses 和 learnorbit_user_courses 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, desc, and_
from sqlalchemy.ext.declarative import declarative_base

from app.database import get_db

router = APIRouter(prefix="/api/creator-courses", tags=["creator-courses"])
Base = declarative_base()

# ==================== 数据模型 ====================

class UserCourse(Base):
    """用户课程表"""
    __tablename__ = 'learnorbit_user_courses'
    
    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), nullable=False)
    course_plan = Column(JSON, nullable=False)
    plan_url = Column(Text)
    current_step = Column(Integer, default=0)
    status = Column(String(20), default='in-progress')
    tasks_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CreatorCourse(Base):
    """创作者课程表"""
    __tablename__ = 'learnorbit_creator_courses'
    
    id = Column(String(255), primary_key=True)
    slug = Column(String(200), unique=True, nullable=False)
    course_id = Column(String(255), nullable=False)
    creator_id = Column(String(255), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    """用户表"""
    __tablename__ = 'learnorbit_user'
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255))
    email = Column(String(255))
    image = Column(Text)


# ==================== Pydantic 模型 ====================

class CreatorCourseCreate(BaseModel):
    """创建创作者课程请求"""
    course_id: str
    title: str
    description: Optional[str] = None


# ==================== API 端点 ====================

@router.post("/")
async def create_creator_course(
    creator_course_data: CreatorCourseCreate,
    db: Session = Depends(get_db)
):
    """创建创作者课程映射"""
    import uuid
    import re
    
    # 获取课程信息
    course = db.query(UserCourse).filter(
        UserCourse.id == creator_course_data.course_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 获取用户信息（检查是否为创作者）
    user = db.query(User).filter(User.id == course.user_id).first()
    
    # 检查课程是否已公开
    course_plan = course.course_plan or {}
    is_public = course_plan.get('isPublic', False)
    
    if not is_public:
        raise HTTPException(status_code=400, detail="Course must be public")
    
    # 生成 slug
    def slugify_title(title: str, user_id: str) -> str:
        slug = title.lower().strip()
        slug = re.sub(r'[^a-z0-9\u4e00-\u9fa5\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return f"{slug}-{user_id}"
    
    slug = slugify_title(creator_course_data.title, course.user_id)
    
    # 检查 slug 是否已存在
    existing = db.query(CreatorCourse).filter(
        CreatorCourse.slug == slug
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="URL slug already exists")
    
    # 创建创作者课程映射
    creator_course = CreatorCourse(
        id=f"creator_course_{uuid.uuid4()}",
        slug=slug,
        course_id=creator_course_data.course_id,
        creator_id=course.user_id,
        title=creator_course_data.title,
        description=creator_course_data.description or '',
        is_active=True
    )
    
    db.add(creator_course)
    db.commit()
    db.refresh(creator_course)
    
    return {
        "success": True,
        "creatorCourse": {
            "id": creator_course.id,
            "slug": creator_course.slug,
            "courseId": creator_course.course_id,
            "creatorId": creator_course.creator_id,
            "title": creator_course.title,
            "description": creator_course.description,
            "isActive": creator_course.is_active,
            "createdAt": creator_course.created_at.isoformat() if creator_course.created_at else None,
            "updatedAt": creator_course.updated_at.isoformat() if creator_course.updated_at else None,
        },
        "url": f"/study/{slug}"
    }


@router.get("/")
async def get_creator_courses(
    creator_id: str = Query(..., description="创作者ID"),
    db: Session = Depends(get_db)
):
    """获取创作者的所有课程"""
    creator_courses = db.query(CreatorCourse).filter(
        and_(
            CreatorCourse.creator_id == creator_id,
            CreatorCourse.is_active == True
        )
    ).order_by(CreatorCourse.created_at).all()
    
    return {
        "success": True,
        "courses": [
            {
                "id": cc.id,
                "slug": cc.slug,
                "courseId": cc.course_id,
                "creatorId": cc.creator_id,
                "title": cc.title,
                "description": cc.description,
                "isActive": cc.is_active,
                "createdAt": cc.created_at.isoformat() if cc.created_at else None,
                "updatedAt": cc.updated_at.isoformat() if cc.updated_at else None,
            }
            for cc in creator_courses
        ]
    }


@router.get("/{slug}")
async def get_creator_course_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """通过 slug 获取创作者课程"""
    # 查找创作者课程
    creator_course = db.query(CreatorCourse).filter(
        and_(
            CreatorCourse.slug == slug,
            CreatorCourse.is_active == True
        )
    ).first()
    
    if not creator_course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 获取课程数据
    course = db.query(UserCourse).filter(
        UserCourse.id == creator_course.course_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course data not found")
    
    # 获取创作者信息
    creator = db.query(User).filter(User.id == creator_course.creator_id).first()
    
    # 检查课程是否公开
    course_plan = course.course_plan or {}
    is_public = course_plan.get('isPublic', False)
    
    if not is_public:
        raise HTTPException(status_code=404, detail="Course not available")
    
    return {
        "success": True,
        "course": {
            "id": course.id,
            "userId": course.user_id,
            "coursePlan": course_plan,
            "currentStep": course.current_step,
            "status": course.status,
            "createdAt": course.created_at.isoformat() if course.created_at else None,
            "updatedAt": course.updated_at.isoformat() if course.updated_at else None,
            "creator": {
                "id": creator_course.creator_id,
                "name": creator.name if creator else None,
                "email": creator.email if creator else None,
                "image": creator.image if creator else None,
            },
            "creatorCourse": {
                "id": creator_course.id,
                "slug": creator_course.slug,
                "title": creator_course.title,
                "description": creator_course.description,
                "isActive": creator_course.is_active,
            }
        }
    }

