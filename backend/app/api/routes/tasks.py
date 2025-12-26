"""
任务管理 API
统一处理前端的任务相关数据库操作
访问公司 MySQL 数据库（learnorbit_user_courses 表）
"""
import asyncio
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base

from app.database import get_db

router = APIRouter(prefix="/open-api/user-courses", tags=["tasks"])
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


# ==================== Pydantic 模型 ====================

class TaskSaveRequest(BaseModel):
    """保存任务请求"""
    step_number: int
    task_content: Dict[str, Any]


class TaskGenerateRequest(BaseModel):
    """生成任务请求"""
    step: int
    title: str
    description: str
    animation_type: str
    status: str
    type: str
    difficulty: str
    videos: list


# ==================== API 端点 ====================

@router.get("/{course_id}/tasks")
async def get_course_tasks(
    course_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """获取课程的所有任务"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 从 coursePlan.tasks 获取任务数据
    course_plan = course.course_plan or {}
    task_cache = course_plan.get('tasks', {})
    
    return {
        "taskCache": task_cache,
        "tasksGenerated": course.tasks_generated,
    }


@router.post("/{course_id}/tasks")
async def save_course_task(
    course_id: str,
    task_data: TaskSaveRequest,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """保存课程任务"""
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 更新 coursePlan.tasks
    course_plan = course.course_plan or {}
    tasks = course_plan.get('tasks', {})
    tasks[str(task_data.step_number)] = task_data.task_content
    
    course_plan['tasks'] = tasks
    course.course_plan = course_plan
    course.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"success": True}


@router.post("/{course_id}/tasks/generate")
async def generate_course_tasks(
    course_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """批量生成课程的所有任务"""
    import os
    import httpx
    
    course = db.query(UserCourse).filter(
        UserCourse.id == course_id,
        UserCourse.user_id == user_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.tasks_generated:
        return {
            "message": "Tasks already generated",
            "tasksGenerated": True,
        }
    
    course_plan = course.course_plan or {}
    plan_data = course_plan.get('plan')
    
    if not plan_data:
        raise HTTPException(status_code=400, detail="Invalid course plan")
    
    # 获取步骤数组
    if isinstance(plan_data, list):
        steps = plan_data
    elif isinstance(plan_data, dict) and 'plan' in plan_data:
        steps = plan_data['plan']
    else:
        steps = []
    
    if not steps:
        raise HTTPException(status_code=400, detail="No steps found in course plan")
    
    # 外部 API URL
    external_api_url = os.getenv('EXTERNAL_API_URL', 'http://172.30.106.167:5000')
    
    # 并行生成所有任务
    async def generate_single_task(step: dict):
        """生成单个任务"""
        step_num = step.get('step')
        try:
            request_data = {
                "step": step_num,
                "title": step.get('title', ''),
                "description": step.get('description', ''),
                "animation_type": step.get('animation_type', '无'),
                "status": step.get('status', 'pending'),
                "type": step.get('type', 'theory'),
                "difficulty": step.get('difficulty', 'beginner'),
                "videos": step.get('videos', []),
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{external_api_url}/api/task/generate",
                    json=request_data,
                    headers={"Content-Type": "application/json", "Accept": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success') and result.get('task'):
                        return {
                            "step": step_num,
                            "success": True,
                            "task": result['task']
                        }
                    else:
                        return {
                            "step": step_num,
                            "success": False,
                            "error": "Generation failed"
                        }
                else:
                    return {
                        "step": step_num,
                        "success": False,
                        "error": f"HTTP {response.status_code}"
                    }
        except Exception as e:
            return {
                "step": step_num,
                "success": False,
                "error": str(e)
            }
    
    # 并行执行所有任务生成
    task_promises = [generate_single_task(step) for step in steps]
    results = await asyncio.gather(*task_promises)
    
    success_count = sum(1 for r in results if r.get('success'))
    
    # 如果大部分任务成功生成，保存到 coursePlan.tasks 并标记为已生成
    if success_count >= len(results) * 0.7:
        tasks = {}
        for result in results:
            if result.get('success') and result.get('task'):
                tasks[str(result['step'])] = result['task']
        
        # 更新课程
        course_plan['tasks'] = {
            **course_plan.get('tasks', {}),
            **tasks
        }
        course.course_plan = course_plan
        course.tasks_generated = True
        course.updated_at = datetime.utcnow()
        
        db.commit()
    
    return {
        "success": True,
        "results": results,
        "successCount": success_count,
        "totalCount": len(results),
        "tasksGenerated": success_count >= len(results) * 0.7,
    }

