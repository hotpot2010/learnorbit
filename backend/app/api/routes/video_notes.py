"""
视频笔记 API
访问公司 MySQL 数据库（learnorbit_user_video_notes 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean, Text, desc, and_
from sqlalchemy.ext.declarative import declarative_base
import uuid

from app.database import get_db

router = APIRouter(prefix="/open-api/video-notes", tags=["video-notes"])
Base = declarative_base()

# ==================== 数据模型 ====================

class UserVideoNote(Base):
    """用户视频笔记表"""
    __tablename__ = 'learnorbit_user_video_notes'
    
    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), nullable=False)
    task_id = Column(String(255), nullable=False)
    video_url = Column(Text, nullable=False)
    bv_id = Column(String(50))
    video_title = Column(Text)
    video_platform = Column(String(20), default='bilibili')
    user_notes_data = Column(JSON, nullable=False)
    title = Column(Text)
    description = Column(Text)
    is_favorite = Column(Boolean, default=False)
    total_knowledge_points = Column(Integer, default=0)
    total_qas = Column(Integer, default=0)
    total_exercises = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_viewed_at = Column(DateTime)


# ==================== Pydantic 模型 ====================

class VideoNoteCreate(BaseModel):
    """创建视频笔记请求"""
    task_id: str
    video_url: str
    bv_id: Optional[str] = None
    video_title: Optional[str] = None
    video_platform: Optional[str] = 'bilibili'
    user_notes_data: dict
    title: Optional[str] = None
    description: Optional[str] = None


class VideoNoteUpdate(BaseModel):
    """更新视频笔记请求"""
    user_notes_data: Optional[dict] = None
    title: Optional[str] = None
    description: Optional[str] = None
    video_title: Optional[str] = None


class VideoNoteResponse(BaseModel):
    """视频笔记响应"""
    id: str
    user_id: str
    task_id: str
    video_url: str
    bv_id: Optional[str]
    video_title: Optional[str]
    video_platform: str
    user_notes_data: dict
    title: Optional[str]
    description: Optional[str]
    is_favorite: bool
    total_knowledge_points: int
    total_qas: int
    total_exercises: int
    created_at: datetime
    updated_at: datetime
    last_viewed_at: Optional[datetime]


# ==================== API 端点 ====================

@router.post("/", response_model=dict)
async def create_or_update_note(
    note_data: VideoNoteCreate,
    user_id: str = Query(..., description="用户ID（从认证token中获取）"),
    db: Session = Depends(get_db)
):
    """创建或更新视频笔记"""
    # 检查是否已存在
    existing = db.query(UserVideoNote).filter(
        and_(
            UserVideoNote.user_id == user_id,
            UserVideoNote.task_id == note_data.task_id
        )
    ).first()
    
    # 计算统计信息
    knowledge_point_notes = note_data.user_notes_data.get('knowledgePointNotes', [])
    stats = {
        'total_knowledge_points': len(knowledge_point_notes),
        'total_qas': sum(len(kp.get('qaList', [])) for kp in knowledge_point_notes),
        'total_exercises': sum(len(kp.get('exercises', [])) for kp in knowledge_point_notes),
    }
    
    if existing:
        # 更新现有笔记
        if note_data.user_notes_data:
            existing.user_notes_data = note_data.user_notes_data
        if note_data.title is not None:
            existing.title = note_data.title
        if note_data.description is not None:
            existing.description = note_data.description
        if note_data.video_title is not None:
            existing.video_title = note_data.video_title
        
        existing.total_knowledge_points = stats['total_knowledge_points']
        existing.total_qas = stats['total_qas']
        existing.total_exercises = stats['total_exercises']
        existing.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(existing)
        
        return {
            "success": True,
            "noteId": existing.id,
            "message": "Note updated successfully",
            "isNew": False
        }
    else:
        # 创建新笔记
        note_id = f"note_{uuid.uuid4()}"
        new_note = UserVideoNote(
            id=note_id,
            user_id=user_id,
            task_id=note_data.task_id,
            video_url=note_data.video_url,
            bv_id=note_data.bv_id,
            video_title=note_data.video_title,
            video_platform=note_data.video_platform or 'bilibili',
            user_notes_data=note_data.user_notes_data,
            title=note_data.title,
            description=note_data.description,
            **stats
        )
        
        db.add(new_note)
        db.commit()
        db.refresh(new_note)
        
        return {
            "success": True,
            "noteId": new_note.id,
            "message": "Note saved successfully",
            "isNew": True
        }


@router.get("/", response_model=dict)
async def get_user_notes(
    user_id: str = Query(..., description="用户ID"),
    task_id: Optional[str] = Query(None, description="任务ID（可选，查询特定视频）"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取用户的视频笔记"""
    try:
        query = db.query(UserVideoNote).filter(UserVideoNote.user_id == user_id)
        
        if task_id:
            query = query.filter(UserVideoNote.task_id == task_id)
        
        # 总数
        total = query.count()
        
        # 分页查询
        notes = query.order_by(desc(UserVideoNote.updated_at))\
                    .offset((page - 1) * limit)\
                    .limit(limit)\
                    .all()
        
        # 将 SQLAlchemy 对象转换为字典
        notes_list = []
        for note in notes:
            notes_list.append({
                "id": note.id,
                "user_id": note.user_id,
                "task_id": note.task_id,
                "video_url": note.video_url,
                "bv_id": note.bv_id,
                "video_title": note.video_title,
                "video_platform": note.video_platform,
                "user_notes_data": note.user_notes_data,
                "title": note.title,
                "description": note.description,
                "is_favorite": note.is_favorite,
                "total_knowledge_points": note.total_knowledge_points,
                "total_qas": note.total_qas,
                "total_exercises": note.total_exercises,
                "created_at": note.created_at.isoformat() if note.created_at else None,
                "updated_at": note.updated_at.isoformat() if note.updated_at else None,
                "last_viewed_at": note.last_viewed_at.isoformat() if note.last_viewed_at else None,
            })
        
        return {
            "success": True,
            "notes": notes_list,
            "page": page,
            "limit": limit,
            "total": total
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{note_id}", response_model=VideoNoteResponse)
async def get_note(
    note_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """获取单个笔记详情"""
    note = db.query(UserVideoNote).filter(
        and_(
            UserVideoNote.id == note_id,
            UserVideoNote.user_id == user_id
        )
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return note


@router.patch("/{note_id}", response_model=VideoNoteResponse)
async def update_note(
    note_id: str,
    note_update: VideoNoteUpdate,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """更新笔记"""
    note = db.query(UserVideoNote).filter(
        and_(
            UserVideoNote.id == note_id,
            UserVideoNote.user_id == user_id
        )
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note_update.user_notes_data is not None:
        note.user_notes_data = note_update.user_notes_data
        # 重新计算统计信息
        knowledge_point_notes = note_update.user_notes_data.get('knowledgePointNotes', [])
        note.total_knowledge_points = len(knowledge_point_notes)
        note.total_qas = sum(len(kp.get('qaList', [])) for kp in knowledge_point_notes)
        note.total_exercises = sum(len(kp.get('exercises', [])) for kp in knowledge_point_notes)
    
    if note_update.title is not None:
        note.title = note_update.title
    if note_update.description is not None:
        note.description = note_update.description
    if note_update.video_title is not None:
        note.video_title = note_update.video_title
    
    note.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(note)
    
    return note


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    user_id: str = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """删除笔记"""
    note = db.query(UserVideoNote).filter(
        and_(
            UserVideoNote.id == note_id,
            UserVideoNote.user_id == user_id
        )
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"success": True, "message": "Note deleted successfully"}

