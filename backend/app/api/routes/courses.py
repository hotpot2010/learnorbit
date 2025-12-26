"""
课程管理 API
统一处理前端的课程相关数据库操作
访问公司 MySQL 数据库（learnorbit_* 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, desc
from sqlalchemy.ext.declarative import declarative_base
import uuid

from app.database import get_db

router = APIRouter(prefix="/api/user-courses", tags=["courses"])
Base = declarative_base()

# ==================== 数据模型 ====================

class UserCourse(Base):
    """用户课程表（对应前端的 learnorbit_user_courses）"""
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
    """创作者课程表（对应前端的 learnorbit_creator_courses）"""
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


# ==================== Pydantic 模型 ====================

class CourseCreate(BaseModel):
    """创建课程请求"""
    user_id: str
    course_plan: dict
    plan_url: Optional[str] = None


class CourseUpdate(BaseModel):
    """更新课程请求"""
    current_step: Optional[int] = None
    status: Optional[str] = None
    tasks_generated: Optional[bool] = None
    course_plan: Optional[dict] = None
    plan_url: Optional[str] = None
    is_public: Optional[bool] = None
    title: Optional[str] = None
    description: Optional[str] = None


class CourseResponse(BaseModel):
    """课程响应"""
    id: str
    user_id: str
    course_plan: dict
    plan_url: Optional[str]
    current_step: int
    status: str
    tasks_generated: bool
    created_at: datetime
    updated_at: datetime


# ==================== API 端点 ====================

@router.post("/", response_model=CourseResponse)
async def create_course(
    course: CourseCreate,
    user_id: str = Query(..., description="用户ID（从认证token中获取）"),
    db: Session = Depends(get_db)
):
    """创建新课程"""
    course_id = f"course_{uuid.uuid4()}"
    
    db_course = UserCourse(
        id=course_id,
        user_id=course.user_id,
        course_plan=course.course_plan,
        plan_url=course.plan_url,
        current_step=0,
        status='in-progress',
        tasks_generated=False
    )
    
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    return db_course


@router.get("/user/{user_id}")
async def get_user_courses(
    user_id: str,
    db: Session = Depends(get_db)
):
    """获取用户的所有课程"""
    courses = db.query(UserCourse).filter(
        UserCourse.user_id == user_id
    ).order_by(desc(UserCourse.created_at)).all()
    
    # 将 SQLAlchemy 对象转换为字典（snake_case -> camelCase）
    # 注意：前端期望 camelCase 格式
    return [
        {
            "id": course.id,
            "userId": course.user_id,
            "coursePlan": course.course_plan if course.course_plan else {},
            "planUrl": course.plan_url,
            "currentStep": course.current_step,
            "status": course.status,
            "tasksGenerated": course.tasks_generated,
            "createdAt": course.created_at.isoformat() if course.created_at else None,
            "updatedAt": course.updated_at.isoformat() if course.updated_at else None,
        }
        for course in courses
    ]


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """获取单个课程详情"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return course


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    course_update: CourseUpdate,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """更新课程信息"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 更新字段
    if course_update.current_step is not None:
        course.current_step = course_update.current_step
    if course_update.status is not None:
        course.status = course_update.status
    if course_update.tasks_generated is not None:
        course.tasks_generated = course_update.tasks_generated
    if course_update.course_plan is not None:
        course.course_plan = course_update.course_plan
    if course_update.plan_url is not None:
        course.plan_url = course_update.plan_url
    
    course.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(course)
    
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course_full(
    course_id: str,
    course_data: CourseCreate,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """完整更新课程（包括 coursePlan）"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course.course_plan = course_data.course_plan
    if course_data.plan_url:
        course.plan_url = course_data.plan_url
    course.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(course)
    
    return course


@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """删除课程"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    db.delete(course)
    db.commit()
    
    return {"message": "Course deleted successfully"}


# ==================== 课程进度 API ====================

@router.put("/{course_id}/progress", response_model=CourseResponse)
async def update_course_progress(
    course_id: str,
    progress_data: dict,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """更新课程进度"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if 'current_step' in progress_data:
        course.current_step = progress_data['current_step']
    if 'status' in progress_data:
        course.status = progress_data['status']
    
    course.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(course)
    
    return course


@router.get("/{course_id}/progress", response_model=CourseResponse)
async def get_course_progress(
    course_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """获取课程进度"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return course


# ==================== 公开课程 API ====================

@router.get("/public/{slug}")
async def get_public_course_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """通过 slug 获取公开课程"""
    creator_course = db.query(CreatorCourse).filter(
        CreatorCourse.slug == slug,
        CreatorCourse.is_active == True
    ).first()
    
    if not creator_course:
        raise HTTPException(status_code=404, detail="Public course not found")
    
    # 获取课程详情
    course = db.query(UserCourse).filter(
        UserCourse.id == creator_course.course_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return {
        "slug": creator_course.slug,
        "title": creator_course.title,
        "description": creator_course.description,
        "course": {
            "id": course.id,
            "course_plan": course.course_plan,
            "plan_url": course.plan_url,
            "created_at": course.created_at,
        }
    }
