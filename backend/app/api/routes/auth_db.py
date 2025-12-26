"""
Better Auth 数据库操作 API
为 Better Auth 自定义适配器提供所有必要的数据库操作
访问公司 MySQL 数据库（learnorbit_user, learnorbit_session, learnorbit_account, learnorbit_verification 表）
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Boolean, Text, and_, or_
from sqlalchemy.ext.declarative import declarative_base

from app.database import get_db

router = APIRouter(prefix="/api/auth-db", tags=["auth-db"])
Base = declarative_base()

# ==================== 数据模型 ====================

class User(Base):
    """用户表"""
    __tablename__ = 'learnorbit_user'
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    email_verified = Column(Boolean, default=False)
    image = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    role = Column(String(50))
    customer_id = Column(String(255))


class Session(Base):
    """会话表"""
    __tablename__ = 'learnorbit_session'
    
    id = Column(String(255), primary_key=True)
    expires_at = Column(DateTime, nullable=False)
    token = Column(String(500), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ip_address = Column(String(100))
    user_agent = Column(Text)
    user_id = Column(String(255), nullable=False)


class Account(Base):
    """第三方账户表"""
    __tablename__ = 'learnorbit_account'
    
    id = Column(String(255), primary_key=True)
    account_id = Column(String(255), nullable=False)
    provider_id = Column(String(100), nullable=False)
    user_id = Column(String(255), nullable=False)
    access_token = Column(Text)
    refresh_token = Column(Text)
    id_token = Column(Text)
    access_token_expires_at = Column(DateTime)
    refresh_token_expires_at = Column(DateTime)
    scope = Column(Text)
    password = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    


class Verification(Base):
    """验证表"""
    __tablename__ = 'learnorbit_verification'
    
    id = Column(String(255), primary_key=True)
    identifier = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== Pydantic 模型 ====================

class UserCreate(BaseModel):
    """创建用户"""
    id: str
    name: str
    email: str
    email_verified: bool = False
    image: Optional[str] = None
    role: Optional[str] = None
    customer_id: Optional[str] = None


class UserUpdate(BaseModel):
    """更新用户"""
    name: Optional[str] = None
    email: Optional[str] = None
    email_verified: Optional[bool] = None
    image: Optional[str] = None
    role: Optional[str] = None
    customer_id: Optional[str] = None


class SessionCreate(BaseModel):
    """创建会话"""
    id: str
    token: str
    user_id: str
    expires_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class SessionUpdate(BaseModel):
    """更新会话"""
    expires_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AccountCreate(BaseModel):
    """创建账户"""
    id: str
    account_id: str
    provider_id: str
    user_id: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None
    access_token_expires_at: Optional[datetime] = None
    refresh_token_expires_at: Optional[datetime] = None
    scope: Optional[str] = None
    password: Optional[str] = None


class AccountUpdate(BaseModel):
    """更新账户"""
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None
    access_token_expires_at: Optional[datetime] = None
    refresh_token_expires_at: Optional[datetime] = None
    scope: Optional[str] = None
    password: Optional[str] = None


class VerificationCreate(BaseModel):
    """创建验证"""
    id: str
    identifier: str
    value: str
    expires_at: datetime


# ==================== User API ====================

@router.post("/user")
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """创建用户"""
    user = User(
        id=user_data.id,
        name=user_data.name,
        email=user_data.email,
        email_verified=user_data.email_verified,
        image=user_data.image,
        role=user_data.role,
        customer_id=user_data.customer_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "image": user.image,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "role": user.role,
        "customer_id": user.customer_id,
    }


@router.get("/user/{user_id}")
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db)
):
    """根据 ID 获取用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "image": user.image,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "role": user.role,
        "customer_id": user.customer_id,
    }


@router.get("/user")
async def get_user_by_email(
    email: str = Query(..., description="用户邮箱"),
    db: Session = Depends(get_db)
):
    """根据邮箱获取用户"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "image": user.image,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "role": user.role,
        "customer_id": user.customer_id,
    }


@router.patch("/user/{user_id}")
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: Session = Depends(get_db)
):
    """更新用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.email_verified is not None:
        user.email_verified = user_data.email_verified
    if user_data.image is not None:
        user.image = user_data.image
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.customer_id is not None:
        user.customer_id = user_data.customer_id
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "image": user.image,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "role": user.role,
        "customer_id": user.customer_id,
    }


@router.delete("/user/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db)
):
    """删除用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    
    return {"success": True}


@router.get("/users")
async def get_users(
    page_index: int = Query(0, ge=0, description="页码索引（从0开始）"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（匹配 name 或 email）"),
    sort_field: Optional[str] = Query(None, description="排序字段（name, email, created_at, role, customer_id）"),
    sort_desc: bool = Query(False, description="是否降序排序"),
    db: Session = Depends(get_db)
):
    """获取用户列表（支持搜索、分页、排序）"""
    from sqlalchemy import func
    
    # 构建查询
    query = db.query(User)
    
    # 搜索条件
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.name.like(search_pattern),
                User.email.like(search_pattern)
            )
        )
    
    # 获取总数
    total = query.count()
    
    # 排序
    if sort_field:
        sort_column_map = {
            "name": User.name,
            "email": User.email,
            "created_at": User.created_at,
            "role": User.role,
            "customer_id": User.customer_id,
        }
        sort_column = sort_column_map.get(sort_field)
        if sort_column:
            if sort_desc:
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
    else:
        # 默认按创建时间降序
        query = query.order_by(User.created_at.desc())
    
    # 分页
    offset = page_index * page_size
    users = query.offset(offset).limit(page_size).all()
    
    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                    "emailVerified": u.email_verified,
                    "image": u.image,
                    "createdAt": u.created_at.isoformat() if u.created_at else None,
                    "updatedAt": u.updated_at.isoformat() if u.updated_at else None,
                    "role": u.role,
                    "customerId": u.customer_id,
                }
                for u in users
            ],
            "total": total,
        }
    }


# ==================== Session API ====================

@router.post("/session")
async def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db)
):
    """创建会话"""
    session = Session(
        id=session_data.id,
        token=session_data.token,
        user_id=session_data.user_id,
        expires_at=session_data.expires_at,
        ip_address=session_data.ip_address,
        user_agent=session_data.user_agent
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "id": session.id,
        "token": session.token,
        "user_id": session.user_id,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
    }


@router.get("/session/{session_id}")
async def get_session_by_id(
    session_id: str,
    db: Session = Depends(get_db)
):
    """根据 ID 获取会话"""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        return None
    
    return {
        "id": session.id,
        "token": session.token,
        "user_id": session.user_id,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
    }


@router.get("/session")
async def get_session_by_token(
    token: str = Query(..., description="会话 token"),
    db: Session = Depends(get_db)
):
    """根据 token 获取会话"""
    session = db.query(Session).filter(Session.token == token).first()
    if not session:
        return None
    
    return {
        "id": session.id,
        "token": session.token,
        "user_id": session.user_id,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
    }


@router.get("/sessions")
async def get_sessions_by_user_id(
    user_id: str = Query(..., description="用户 ID"),
    db: Session = Depends(get_db)
):
    """获取用户的所有会话"""
    sessions = db.query(Session).filter(Session.user_id == user_id).all()
    
    return [
        {
            "id": s.id,
            "token": s.token,
            "user_id": s.user_id,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
        }
        for s in sessions
    ]


@router.patch("/session/{session_id}")
async def update_session(
    session_id: str,
    session_data: SessionUpdate,
    db: Session = Depends(get_db)
):
    """更新会话"""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session_data.expires_at is not None:
        session.expires_at = session_data.expires_at
    if session_data.ip_address is not None:
        session.ip_address = session_data.ip_address
    if session_data.user_agent is not None:
        session.user_agent = session_data.user_agent
    
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    
    return {
        "id": session.id,
        "token": session.token,
        "user_id": session.user_id,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "ip_address": session.ip_address,
        "user_agent": session.user_agent,
    }


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """删除会话"""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    
    return {"success": True}


@router.delete("/sessions")
async def delete_sessions_by_user_id(
    user_id: str = Query(..., description="用户 ID"),
    db: Session = Depends(get_db)
):
    """删除用户的所有会话"""
    db.query(Session).filter(Session.user_id == user_id).delete()
    db.commit()
    
    return {"success": True}


# ==================== Account API ====================

@router.post("/account")
async def create_account(
    account_data: AccountCreate,
    db: Session = Depends(get_db)
):
    """创建账户"""
    account = Account(
        id=account_data.id,
        account_id=account_data.account_id,
        provider_id=account_data.provider_id,
        user_id=account_data.user_id,
        access_token=account_data.access_token,
        refresh_token=account_data.refresh_token,
        id_token=account_data.id_token,
        access_token_expires_at=account_data.access_token_expires_at,
        refresh_token_expires_at=account_data.refresh_token_expires_at,
        scope=account_data.scope,
        password=account_data.password
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    
    return {
        "id": account.id,
        "account_id": account.account_id,
        "provider_id": account.provider_id,
        "user_id": account.user_id,
        "access_token": account.access_token,
        "refresh_token": account.refresh_token,
        "id_token": account.id_token,
        "access_token_expires_at": account.access_token_expires_at.isoformat() if account.access_token_expires_at else None,
        "refresh_token_expires_at": account.refresh_token_expires_at.isoformat() if account.refresh_token_expires_at else None,
        "scope": account.scope,
        "password": account.password,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


@router.get("/account/{account_id}")
async def get_account_by_id(
    account_id: str,
    db: Session = Depends(get_db)
):
    """根据 ID 获取账户"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return None
    
    return {
        "id": account.id,
        "account_id": account.account_id,
        "provider_id": account.provider_id,
        "user_id": account.user_id,
        "access_token": account.access_token,
        "refresh_token": account.refresh_token,
        "id_token": account.id_token,
        "access_token_expires_at": account.access_token_expires_at.isoformat() if account.access_token_expires_at else None,
        "refresh_token_expires_at": account.refresh_token_expires_at.isoformat() if account.refresh_token_expires_at else None,
        "scope": account.scope,
        "password": account.password,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


@router.get("/account")
async def get_account_by_provider(
    provider_id: str = Query(..., description="提供商 ID"),
    account_id: str = Query(..., description="账户 ID"),
    db: Session = Depends(get_db)
):
    """根据提供商和账户 ID 获取账户"""
    account = db.query(Account).filter(
        Account.provider_id == provider_id,
        Account.account_id == account_id
    ).first()
    if not account:
        return None
    
    return {
        "id": account.id,
        "account_id": account.account_id,
        "provider_id": account.provider_id,
        "user_id": account.user_id,
        "access_token": account.access_token,
        "refresh_token": account.refresh_token,
        "id_token": account.id_token,
        "access_token_expires_at": account.access_token_expires_at.isoformat() if account.access_token_expires_at else None,
        "refresh_token_expires_at": account.refresh_token_expires_at.isoformat() if account.refresh_token_expires_at else None,
        "scope": account.scope,
        "password": account.password,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


@router.get("/accounts")
async def get_accounts_by_user_id(
    user_id: str = Query(..., description="用户 ID"),
    db: Session = Depends(get_db)
):
    """获取用户的所有账户"""
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    return [
        {
            "id": a.id,
            "account_id": a.account_id,
            "provider_id": a.provider_id,
            "user_id": a.user_id,
            "access_token": a.access_token,
            "refresh_token": a.refresh_token,
            "id_token": a.id_token,
            "access_token_expires_at": a.access_token_expires_at.isoformat() if a.access_token_expires_at else None,
            "refresh_token_expires_at": a.refresh_token_expires_at.isoformat() if a.refresh_token_expires_at else None,
            "scope": a.scope,
            "password": a.password,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in accounts
    ]


@router.patch("/account/{account_id}")
async def update_account(
    account_id: str,
    account_data: AccountUpdate,
    db: Session = Depends(get_db)
):
    """更新账户"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account_data.access_token is not None:
        account.access_token = account_data.access_token
    if account_data.refresh_token is not None:
        account.refresh_token = account_data.refresh_token
    if account_data.id_token is not None:
        account.id_token = account_data.id_token
    if account_data.access_token_expires_at is not None:
        account.access_token_expires_at = account_data.access_token_expires_at
    if account_data.refresh_token_expires_at is not None:
        account.refresh_token_expires_at = account_data.refresh_token_expires_at
    if account_data.scope is not None:
        account.scope = account_data.scope
    if account_data.password is not None:
        account.password = account_data.password
    
    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(account)
    
    return {
        "id": account.id,
        "account_id": account.account_id,
        "provider_id": account.provider_id,
        "user_id": account.user_id,
        "access_token": account.access_token,
        "refresh_token": account.refresh_token,
        "id_token": account.id_token,
        "access_token_expires_at": account.access_token_expires_at.isoformat() if account.access_token_expires_at else None,
        "refresh_token_expires_at": account.refresh_token_expires_at.isoformat() if account.refresh_token_expires_at else None,
        "scope": account.scope,
        "password": account.password,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


@router.delete("/account/{account_id}")
async def delete_account(
    account_id: str,
    db: Session = Depends(get_db)
):
    """删除账户"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db.delete(account)
    db.commit()
    
    return {"success": True}


@router.delete("/accounts")
async def delete_accounts_by_user_id(
    user_id: str = Query(..., description="用户 ID"),
    db: Session = Depends(get_db)
):
    """删除用户的所有账户"""
    db.query(Account).filter(Account.user_id == user_id).delete()
    db.commit()
    
    return {"success": True}


# ==================== Verification API ====================

@router.post("/verification")
async def create_verification(
    verification_data: VerificationCreate,
    db: Session = Depends(get_db)
):
    """创建验证"""
    verification = Verification(
        id=verification_data.id,
        identifier=verification_data.identifier,
        value=verification_data.value,
        expires_at=verification_data.expires_at
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    return {
        "id": verification.id,
        "identifier": verification.identifier,
        "value": verification.value,
        "expires_at": verification.expires_at.isoformat() if verification.expires_at else None,
        "created_at": verification.created_at.isoformat() if verification.created_at else None,
        "updated_at": verification.updated_at.isoformat() if verification.updated_at else None,
    }


@router.get("/verification/{verification_id}")
async def get_verification_by_id(
    verification_id: str,
    db: Session = Depends(get_db)
):
    """根据 ID 获取验证"""
    verification = db.query(Verification).filter(Verification.id == verification_id).first()
    if not verification:
        return None
    
    return {
        "id": verification.id,
        "identifier": verification.identifier,
        "value": verification.value,
        "expires_at": verification.expires_at.isoformat() if verification.expires_at else None,
        "created_at": verification.created_at.isoformat() if verification.created_at else None,
        "updated_at": verification.updated_at.isoformat() if verification.updated_at else None,
    }


@router.get("/verification")
async def get_verification_by_identifier_or_value(
    identifier: str = Query(None, description="标识符"),
    value: str = Query(None, description="值（用于 OAuth state 查询）"),
    db: Session = Depends(get_db)
):
    """根据标识符或值获取验证"""
    if not identifier and not value:
        raise HTTPException(status_code=400, detail="Either identifier or value must be provided")
    
    query = db.query(Verification).filter(
        Verification.expires_at > datetime.utcnow()
    )
    
    if identifier:
        query = query.filter(Verification.identifier == identifier)
    if value:
        query = query.filter(Verification.value == value)
    
    verification = query.order_by(Verification.created_at.desc()).first()
    
    if not verification:
        return None
    
    return {
        "id": verification.id,
        "identifier": verification.identifier,
        "value": verification.value,
        "expires_at": verification.expires_at.isoformat() if verification.expires_at else None,
        "created_at": verification.created_at.isoformat() if verification.created_at else None,
        "updated_at": verification.updated_at.isoformat() if verification.updated_at else None,
    }


@router.delete("/verification/{verification_id}")
async def delete_verification(
    verification_id: str,
    db: Session = Depends(get_db)
):
    """删除验证"""
    verification = db.query(Verification).filter(Verification.id == verification_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    db.delete(verification)
    db.commit()
    
    return {"success": True}

