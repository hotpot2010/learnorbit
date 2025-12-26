"""
用户行为分析 API
访问公司 MySQL 数据库（learnorbit_key_actions 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, JSON, DateTime, BigInteger, desc, func
from sqlalchemy.ext.declarative import declarative_base
import time

from app.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
Base = declarative_base()

# ==================== 数据模型 ====================

class KeyAction(Base):
    """关键用户行为表"""
    __tablename__ = 'learnorbit_key_actions'
    
    id = Column(String(255), primary_key=True)
    event_name = Column(String(50), nullable=False)
    timestamp = Column(BigInteger, nullable=False)
    server_timestamp = Column(DateTime, default=datetime.utcnow)
    session_id = Column(String(200), nullable=False)
    user_id = Column(String(255), nullable=False)
    locale = Column(String(10), nullable=False)
    device_type = Column(String(20), nullable=False)
    user_agent = Column(String(1000))
    page_path = Column(String(500), nullable=False)
    page_title = Column(String(200))
    action_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ==================== Pydantic 模型 ====================

class KeyActionEvent(BaseModel):
    """关键行为事件"""
    event_name: str
    timestamp: int
    session_id: str
    user_id: str
    locale: str
    device_type: str
    user_agent: Optional[str] = None
    page_path: str
    page_title: Optional[str] = None
    action_data: Dict[str, Any]


class KeyActionResponse(BaseModel):
    """行为事件响应"""
    success: bool


class StatsResponse(BaseModel):
    """统计数据响应"""
    total_events: int
    events_by_type: Dict[str, int]
    events_by_user: Dict[str, int]
    recent_events: List[Dict[str, Any]]


# ==================== API 端点 ====================

@router.post("/key-actions", response_model=KeyActionResponse)
async def create_key_action(
    event: KeyActionEvent,
    db: Session = Depends(get_db)
):
    """记录关键用户行为"""
    # 验证事件名称
    valid_events = [
        'generate_course',
        'start_learning',
        'continue_learning',
        'start_video_learning',
        'video_search',
        'video_ask_question',
        'video_screenshot',
        'video_exercise'
    ]
    
    if event.event_name not in valid_events:
        raise HTTPException(
            status_code=400,
            detail=f'Invalid event_name. Must be one of: {", ".join(valid_events)}'
        )
    
    # 创建记录
    action_id = f"key_action_{int(time.time() * 1000)}_{event.session_id[:8]}"
    
    key_action = KeyAction(
        id=action_id,
        event_name=event.event_name,
        timestamp=event.timestamp,
        session_id=event.session_id,
        user_id=event.user_id,
        locale=event.locale,
        device_type=event.device_type,
        user_agent=event.user_agent,
        page_path=event.page_path,
        page_title=event.page_title,
        action_data=event.action_data
    )
    
    db.add(key_action)
    db.commit()
    
    return {"success": True}


@router.get("/stats", response_model=dict)
async def get_stats(
    start_date: Optional[str] = Query(None, alias="startDate", description="开始日期（YYYY-MM-DD）"),
    end_date: Optional[str] = Query(None, alias="endDate", description="结束日期（YYYY-MM-DD）"),
    exclude_user_ids: Optional[str] = Query(None, alias="excludeUserIds", description="排除的用户ID（逗号分隔）"),
    db: Session = Depends(get_db)
):
    """获取统计数据（与前端期望的格式一致）"""
    from sqlalchemy import func, distinct, case
    
    query = db.query(KeyAction)
    
    # 过滤条件
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(KeyAction.server_timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid startDate format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(KeyAction.server_timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid endDate format. Use YYYY-MM-DD")
    
    # 排除特定用户
    if exclude_user_ids:
        exclude_ids = [id.strip() for id in exclude_user_ids.split(',') if id.strip()]
        if exclude_ids:
            query = query.filter(~KeyAction.user_id.in_(exclude_ids))
    
    # 1. 总访问用户数（去重）
    total_users_result = query.with_entities(distinct(KeyAction.user_id)).all()
    total_users = len(total_users_result)
    
    # 2. 各个操作的用户数
    action_users_result = query.with_entities(
        KeyAction.event_name,
        KeyAction.user_id
    ).all()
    
    # 按事件类型分组统计唯一用户数
    action_user_counts: dict = {}
    for event_name, user_id in action_users_result:
        if event_name not in action_user_counts:
            action_user_counts[event_name] = set()
        action_user_counts[event_name].add(user_id)
    
    action_stats = [
        {"eventName": event_name, "userCount": len(users)}
        for event_name, users in action_user_counts.items()
    ]
    
    # 3. 多天访问用户（访问日期 >= 2 天的用户）
    from sqlalchemy import func as sql_func
    user_days_result = query.with_entities(
        KeyAction.user_id,
        sql_func.date(KeyAction.server_timestamp).label('date')
    ).all()
    
    # 统计每个用户的访问天数
    user_visit_days: dict = {}
    for user_id, date in user_days_result:
        if user_id not in user_visit_days:
            user_visit_days[user_id] = set()
        user_visit_days[user_id].add(str(date))
    
    multi_day_users = [
        {"userId": user_id, "dayCount": len(days)}
        for user_id, days in user_visit_days.items()
        if len(days) >= 2
    ]
    
    # 4. 漏斗数据
    funnel = {
        event_name: len(users)
        for event_name, users in action_user_counts.items()
    }
    
    # 5. 用户详情列表
    user_details = []
    for user_id, days in user_visit_days.items():
        user_actions = [event_name for event_name, uid in action_users_result if uid == user_id]
        
        # 统计每个操作的次数
        action_counts: dict = {}
        for event_name in user_actions:
            action_counts[event_name] = action_counts.get(event_name, 0) + 1
        
        user_details.append({
            "userId": user_id,
            "dayCount": len(days),
            "isMultiDay": len(days) >= 2,
            "actions": list(set(user_actions)),  # 去重
            "actionCounts": action_counts,
        })
    
    return {
        "success": True,
        "data": {
            "totalUsers": total_users,
            "actionStats": action_stats,
            "multiDayUsers": multi_day_users,
            "funnel": funnel,
            "userDetails": user_details,
        }
    }

