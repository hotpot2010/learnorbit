"""
公开课程 API
访问公司 MySQL 数据库（learnorbit_user_courses 表）
处理公开课程的查询逻辑
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, desc
from sqlalchemy.ext.declarative import declarative_base
import httpx
import json

from app.database import get_db

router = APIRouter(prefix="/api/public-courses", tags=["public-courses"])

# 注意：公开课程列表 API 在 public_courses_list.py 中
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


def slugify_title(title: str) -> str:
    """将标题转换为 slug"""
    if not title:
        return ''
    import re
    # 转换为小写，替换空格为连字符，移除特殊字符
    slug = title.lower().strip()
    slug = re.sub(r'[^a-z0-9\u4e00-\u9fa5\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug


async def download_json_from_cdn(url: str) -> Optional[dict]:
    """从 CDN URL 下载 JSON 内容"""
    try:
        print(f"📥 从 CDN 下载 JSON: {url}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers={'Accept': 'application/json'})
            response.raise_for_status()
            json_data = response.json()
            print(f"✅ 下载成功，数据大小: {len(json.dumps(json_data))} 字符")
            return json_data
    except Exception as e:
        print(f"❌ 下载失败: {e}")
        return None


@router.get("/{slug}")
async def get_public_course_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """通过 slug 获取公开课程"""
    # FastAPI 会自动解码路径参数，但如果传入的是双重编码的值，需要再次解码
    from urllib.parse import unquote
    try:
        # 尝试解码（处理可能的双重编码）
        decoded = unquote(slug)
        # 如果解码后仍然包含编码字符，再次解码
        if '%' in decoded:
            decoded = unquote(decoded)
    except Exception as e:
        # 解码失败，使用原始值
        decoded = slug
    
    print(f"🔍 Backend API - Received slug: {slug}, decoded: {decoded}")
    
    last_dash = decoded.rfind('-')
    
    if last_dash <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid slug format: {slug} -> {decoded}")
    
    title_part_raw = decoded[:last_dash]
    title_part = slugify_title(title_part_raw)
    user_id = decoded[last_dash + 1:]
    
    print(f"🔍 Backend API - Parsed: title_part={title_part}, user_id={user_id}")
    
    # 先按 userId 过滤
    courses = db.query(UserCourse).filter(
        UserCourse.user_id == user_id
    ).all()
    
    print(f"🔍 Backend API - Found {len(courses)} courses for user {user_id}")
    
    # 检查每个课程是否匹配
    match = None
    for course in courses:
        # 获取 coursePlan 数据
        # MySQL JSON 字段在 SQLAlchemy 中可能需要特殊处理
        course_plan_data = course.course_plan
        
        # 调试：打印 course_plan 的类型和值（只打印前200字符）
        course_plan_str = str(course_plan_data)[:200] if course_plan_data else "None"
        print(f"🔍 Course {course.id}: course_plan type={type(course_plan_data)}, value={course_plan_str}, plan_url={course.plan_url}")
        
        # 如果 course_plan 是 None、空字符串或空字典，但有 plan_url，说明数据在 CDN
        if not course_plan_data:
            if course.plan_url:
                print(f"📥 Course {course.id} has plan_url, downloading from CDN: {course.plan_url}")
                # 从 CDN 下载 coursePlan 数据
                course_plan_data = await download_json_from_cdn(course.plan_url)
                if not course_plan_data:
                    print(f"⚠️ Course {course.id}: Failed to download from CDN")
                    continue
            else:
                print(f"⚠️ Course {course.id} has no course_plan_data and no plan_url")
                continue
        
        # 如果 course_plan 是字符串，尝试解析 JSON
        if isinstance(course_plan_data, str):
            try:
                import json
                course_plan_data = json.loads(course_plan_data)
                print(f"✅ Course {course.id}: Parsed JSON string to dict")
            except Exception as e:
                print(f"❌ Course {course.id}: Failed to parse JSON string: {e}")
                continue
        
        # 确保 course_plan_data 是字典类型
        if not isinstance(course_plan_data, dict):
            print(f"⚠️ Course {course.id}: course_plan_data is not a dict, type={type(course_plan_data)}")
            continue
        
        # 检查 isPublic
        is_public = course_plan_data.get('isPublic', False)
        if not is_public:
            print(f"⚠️ Course {course.id} is not public (isPublic={is_public})")
            continue
        
        # 解析 plan 数据
        raw_plan = course_plan_data.get('plan', {})
        
        if isinstance(raw_plan, dict) and not isinstance(raw_plan, list):
            # 新格式：包含 title、description、plan 的对象
            course_title = raw_plan.get('title', '')
        else:
            # 旧格式：直接是步骤数组
            plan_steps = raw_plan if isinstance(raw_plan, list) else []
            course_title = plan_steps[0].get('title', '') if plan_steps else ''
        
        slugified_title = slugify_title(course_title)
        
        print(f"🔍 Course {course.id}: title={course_title}, slugified={slugified_title}, match={slugified_title == title_part}")
        
        if slugified_title == title_part:
            match = course
            break
    
    # 如果按 userId 未匹配，扫描全部公开课程
    if not match:
        print(f"🔍 No match found for user {user_id}, scanning all public courses...")
        all_courses = db.query(UserCourse).all()
        
        candidates = []
        for course in all_courses:
            course_plan_data = course.course_plan
            
            # 如果 course_plan 是 None 但有 plan_url，从 CDN 下载
            if not course_plan_data:
                if course.plan_url:
                    course_plan_data = await download_json_from_cdn(course.plan_url)
                    if not course_plan_data:
                        continue
                else:
                    continue
            
            # 如果 course_plan 是字符串，尝试解析 JSON
            if isinstance(course_plan_data, str):
                try:
                    course_plan_data = json.loads(course_plan_data)
                except Exception as e:
                    print(f"❌ Course {course.id}: Failed to parse JSON string: {e}")
                    continue
            
            if not course_plan_data or not isinstance(course_plan_data, dict):
                continue
            
            if not course_plan_data.get('isPublic'):
                continue
            
            raw_plan = course_plan_data.get('plan', {})
            
            if isinstance(raw_plan, dict) and not isinstance(raw_plan, list):
                course_title = raw_plan.get('title', '')
            else:
                plan_steps = raw_plan if isinstance(raw_plan, list) else []
                course_title = plan_steps[0].get('title', '') if plan_steps else ''
            
            slugified_title = slugify_title(course_title)
            
            if slugified_title == title_part:
                candidates.append(course)
        
        print(f"🔍 Found {len(candidates)} candidates with matching title")
        
        if candidates:
            # 按创建时间排序，取最新的
            candidates.sort(key=lambda c: c.created_at, reverse=True)
            match = candidates[0]
    
    if not match:
        raise HTTPException(status_code=404, detail=f"Course not found: slug={slug}, decoded={decoded}, title_part={title_part}, user_id={user_id}")
    
    # 获取最终的 coursePlan 数据
    # 如果数据库中的 course_plan 为 None 但 plan_url 有值，从 CDN 下载
    final_course_plan = match.course_plan
    
    if not final_course_plan and match.plan_url:
        print(f"📥 最终返回前，从 CDN 下载完整的 coursePlan: {match.plan_url}")
        final_course_plan = await download_json_from_cdn(match.plan_url)
        if not final_course_plan:
            print(f"⚠️ 从 CDN 下载失败，返回空对象")
            final_course_plan = {}
    elif isinstance(final_course_plan, str):
        # 如果 course_plan 是字符串，尝试解析 JSON
        try:
            final_course_plan = json.loads(final_course_plan)
        except Exception as e:
            print(f"❌ 解析 course_plan JSON 字符串失败: {e}")
            final_course_plan = {}
    
    # 确保返回的是字典类型
    if not isinstance(final_course_plan, dict):
        print(f"⚠️ course_plan 不是字典类型，设为空对象")
        final_course_plan = {}
    
    print(f"✅ 返回的 coursePlan 结构: plan={bool(final_course_plan.get('plan'))}, tasks={bool(final_course_plan.get('tasks'))}, notes={bool(final_course_plan.get('notes'))}, marks={bool(final_course_plan.get('marks'))}")
    
    return {
        "course": {
            "id": match.id,
            "userId": match.user_id,
            "coursePlan": final_course_plan,  # 使用处理后的完整 coursePlan
            "planUrl": match.plan_url,
            "currentStep": match.current_step,
            "status": match.status,
            "tasksGenerated": match.tasks_generated,
            "createdAt": match.created_at.isoformat() if match.created_at else None,
            "updatedAt": match.updated_at.isoformat() if match.updated_at else None,
        }
    }

