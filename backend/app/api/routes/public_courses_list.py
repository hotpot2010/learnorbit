"""
公开课程列表 API
统一处理前端的公开课程列表查询
访问公司 MySQL 数据库（learnorbit_creator_courses 和 learnorbit_user_courses 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, desc, and_
from sqlalchemy.ext.declarative import declarative_base

from app.database import get_db

router = APIRouter(prefix="/api/public-courses", tags=["public-courses"])
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


@router.get("/")
async def get_public_courses_list(
    search: Optional[str] = Query(None, description="搜索关键词"),
    db: Session = Depends(get_db)
):
    """获取公开课程列表"""
    # 先从 creator_courses 表获取所有活跃的课程 ID
    active_creator_courses = db.query(CreatorCourse).filter(
        CreatorCourse.is_active == True
    ).all()
    
    course_ids = [cc.course_id for cc in active_creator_courses]
    
    if not course_ids:
        return {"courses": []}
    
    # 只查询这些课程 ID 对应的课程
    courses = db.query(UserCourse).filter(
        UserCourse.id.in_(course_ids)
    ).order_by(desc(UserCourse.created_at)).all()
    
    # 规范化输出，供首页卡片使用
    normalized = []
    for course in courses:
        course_plan = course.course_plan or {}
        raw_plan = course_plan.get('plan')
        
        # 兼容新旧格式
        if isinstance(raw_plan, dict) and not isinstance(raw_plan, list):
            # 新格式：包含 title、description、plan 的对象
            course_title = raw_plan.get('title', 'Untitled Course')
            course_description = raw_plan.get('description', 'No description')
            plan_steps = raw_plan.get('plan', [])
        else:
            # 旧格式：直接是步骤数组
            plan_steps = raw_plan if isinstance(raw_plan, list) else []
            course_title = plan_steps[0].get('title', 'Untitled Course') if plan_steps else 'Untitled Course'
            course_description = plan_steps[0].get('description', 'No description') if plan_steps else 'No description'
        
        first_video = plan_steps[0].get('videos', [{}])[0] if plan_steps else {}
        cover_image = first_video.get('cover', '/images/blog/post-1.png')
        type_value = plan_steps[0].get('type', 'theory') if plan_steps else 'theory'
        difficulty = 'intermediate' if type_value == 'coding' else 'beginner'
        
        normalized.append({
            "id": course.id,
            "userId": course.user_id,
            "coursePlan": course.course_plan,  # 保留原始 coursePlan 数据
            "planUrl": course.plan_url,  # 保留 planUrl，前端可能需要从 CDN 下载
            "title": course_title,
            "description": course_description,
            "coverImage": cover_image,
            "rating": 4,
            "difficulty": difficulty,
            "ownerId": course.user_id,
            "createdAt": course.created_at.isoformat() if course.created_at else None,
        })
    
    # 如果有搜索参数，进行过滤
    if search:
        search_lower = search.lower()
        normalized = [
            course for course in normalized
            if search_lower in course['title'].lower() or search_lower in course['description'].lower()
        ]
    
    # 按创建时间降序排序
    normalized.sort(key=lambda x: x['createdAt'] or '', reverse=True)
    
    return {"courses": normalized}

