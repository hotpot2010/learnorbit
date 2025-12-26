"""
支付相关 API
访问公司 MySQL 数据库（learnorbit_payment 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, and_, or_
from sqlalchemy.ext.declarative import declarative_base

from app.database import get_db

router = APIRouter(prefix="/open-api/payment", tags=["payment"])
Base = declarative_base()

# ==================== 数据模型 ====================

class Payment(Base):
    """支付表"""
    __tablename__ = 'learnorbit_payment'
    
    id = Column(String(255), primary_key=True)
    price_id = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    interval = Column(String(50))
    user_id = Column(String(255), nullable=False)
    customer_id = Column(String(255), nullable=False)
    subscription_id = Column(String(255))
    status = Column(String(50), nullable=False)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    cancel_at_period_end = Column(Boolean, default=False)
    trial_start = Column(DateTime)
    trial_end = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== 请求/响应模型 ====================

class PaymentCreate(BaseModel):
    id: str
    price_id: str
    type: str
    interval: Optional[str] = None
    user_id: str
    customer_id: str
    subscription_id: Optional[str] = None
    status: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    cancel_at_period_end: Optional[bool] = False
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None


class PaymentUpdate(BaseModel):
    price_id: Optional[str] = None
    type: Optional[str] = None
    interval: Optional[str] = None
    subscription_id: Optional[str] = None
    status: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    cancel_at_period_end: Optional[bool] = None
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None


# ==================== Payment API ====================

@router.post("")
async def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db)
):
    """创建支付记录"""
    payment = Payment(
        id=payment_data.id,
        price_id=payment_data.price_id,
        type=payment_data.type,
        interval=payment_data.interval,
        user_id=payment_data.user_id,
        customer_id=payment_data.customer_id,
        subscription_id=payment_data.subscription_id,
        status=payment_data.status,
        period_start=payment_data.period_start,
        period_end=payment_data.period_end,
        cancel_at_period_end=payment_data.cancel_at_period_end,
        trial_start=payment_data.trial_start,
        trial_end=payment_data.trial_end,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    return {
        "id": payment.id,
        "priceId": payment.price_id,
        "type": payment.type,
        "interval": payment.interval,
        "userId": payment.user_id,
        "customerId": payment.customer_id,
        "subscriptionId": payment.subscription_id,
        "status": payment.status,
        "periodStart": payment.period_start.isoformat() if payment.period_start else None,
        "periodEnd": payment.period_end.isoformat() if payment.period_end else None,
        "cancelAtPeriodEnd": payment.cancel_at_period_end,
        "trialStart": payment.trial_start.isoformat() if payment.trial_start else None,
        "trialEnd": payment.trial_end.isoformat() if payment.trial_end else None,
        "createdAt": payment.created_at.isoformat() if payment.created_at else None,
        "updatedAt": payment.updated_at.isoformat() if payment.updated_at else None,
    }


@router.get("/{payment_id}")
async def get_payment_by_id(
    payment_id: str,
    db: Session = Depends(get_db)
):
    """根据 ID 获取支付记录"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {
        "id": payment.id,
        "priceId": payment.price_id,
        "type": payment.type,
        "interval": payment.interval,
        "userId": payment.user_id,
        "customerId": payment.customer_id,
        "subscriptionId": payment.subscription_id,
        "status": payment.status,
        "periodStart": payment.period_start.isoformat() if payment.period_start else None,
        "periodEnd": payment.period_end.isoformat() if payment.period_end else None,
        "cancelAtPeriodEnd": payment.cancel_at_period_end,
        "trialStart": payment.trial_start.isoformat() if payment.trial_start else None,
        "trialEnd": payment.trial_end.isoformat() if payment.trial_end else None,
        "createdAt": payment.created_at.isoformat() if payment.created_at else None,
        "updatedAt": payment.updated_at.isoformat() if payment.updated_at else None,
    }


@router.get("")
async def get_payments_by_user_id(
    user_id: str = Query(..., description="用户 ID"),
    type: Optional[str] = Query(None, description="支付类型"),
    status: Optional[str] = Query(None, description="支付状态"),
    db: Session = Depends(get_db)
):
    """获取用户的支付记录"""
    query = db.query(Payment).filter(Payment.user_id == user_id)
    
    if type:
        query = query.filter(Payment.type == type)
    if status:
        query = query.filter(Payment.status == status)
    
    payments = query.all()
    
    return [
        {
            "id": p.id,
            "priceId": p.price_id,
            "type": p.type,
            "interval": p.interval,
            "userId": p.user_id,
            "customerId": p.customer_id,
            "subscriptionId": p.subscription_id,
            "status": p.status,
            "periodStart": p.period_start.isoformat() if p.period_start else None,
            "periodEnd": p.period_end.isoformat() if p.period_end else None,
            "cancelAtPeriodEnd": p.cancel_at_period_end,
            "trialStart": p.trial_start.isoformat() if p.trial_start else None,
            "trialEnd": p.trial_end.isoformat() if p.trial_end else None,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
            "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in payments
    ]


@router.patch("/{payment_id}")
async def update_payment(
    payment_id: str,
    payment_data: PaymentUpdate,
    db: Session = Depends(get_db)
):
    """更新支付记录"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment_data.price_id is not None:
        payment.price_id = payment_data.price_id
    if payment_data.type is not None:
        payment.type = payment_data.type
    if payment_data.interval is not None:
        payment.interval = payment_data.interval
    if payment_data.subscription_id is not None:
        payment.subscription_id = payment_data.subscription_id
    if payment_data.status is not None:
        payment.status = payment_data.status
    if payment_data.period_start is not None:
        payment.period_start = payment_data.period_start
    if payment_data.period_end is not None:
        payment.period_end = payment_data.period_end
    if payment_data.cancel_at_period_end is not None:
        payment.cancel_at_period_end = payment_data.cancel_at_period_end
    if payment_data.trial_start is not None:
        payment.trial_start = payment_data.trial_start
    if payment_data.trial_end is not None:
        payment.trial_end = payment_data.trial_end
    
    payment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    
    return {
        "id": payment.id,
        "priceId": payment.price_id,
        "type": payment.type,
        "interval": payment.interval,
        "userId": payment.user_id,
        "customerId": payment.customer_id,
        "subscriptionId": payment.subscription_id,
        "status": payment.status,
        "periodStart": payment.period_start.isoformat() if payment.period_start else None,
        "periodEnd": payment.period_end.isoformat() if payment.period_end else None,
        "cancelAtPeriodEnd": payment.cancel_at_period_end,
        "trialStart": payment.trial_start.isoformat() if payment.trial_start else None,
        "trialEnd": payment.trial_end.isoformat() if payment.trial_end else None,
        "createdAt": payment.created_at.isoformat() if payment.created_at else None,
        "updatedAt": payment.updated_at.isoformat() if payment.updated_at else None,
    }


@router.get("/user/{user_id}/lifetime-status")
async def get_lifetime_status(
    user_id: str,
    lifetime_plan_ids: str = Query(..., description="Lifetime plan IDs (comma-separated)"),
    db: Session = Depends(get_db)
):
    """获取用户的 lifetime membership 状态"""
    # 解析 lifetime plan IDs
    lifetime_plan_id_list = [pid.strip() for pid in lifetime_plan_ids.split(',') if pid.strip()]
    
    if not lifetime_plan_id_list:
        return {
            "success": False,
            "error": "No lifetime plans provided",
        }
    
    # 查询用户的一次性支付记录（type='one_time' 且 status='completed'）
    payments = db.query(Payment).filter(
        and_(
            Payment.user_id == user_id,
            Payment.type == 'one_time',
            Payment.status == 'completed'
        )
    ).all()
    
    # 检查是否有任何支付记录的 price_id 在 lifetime plan IDs 列表中
    has_lifetime_payment = any(
        payment.price_id in lifetime_plan_id_list
        for payment in payments
    )
    
    return {
        "success": True,
        "isLifetimeMember": has_lifetime_payment,
    }

