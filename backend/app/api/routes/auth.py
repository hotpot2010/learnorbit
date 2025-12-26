"""
用户认证 API
处理用户登录、注册、会话管理
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
import bcrypt
import secrets

from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
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
    password = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== Pydantic 模型 ====================

class UserRegister(BaseModel):
    """用户注册"""
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    """用户登录"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """用户响应"""
    id: str
    name: str
    email: str
    email_verified: bool
    image: Optional[str]
    role: Optional[str]
    created_at: datetime


class SessionResponse(BaseModel):
    """会话响应"""
    token: str
    expires_at: datetime
    user: UserResponse


# ==================== API 端点 ====================

@router.post("/register", response_model=SessionResponse)
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """用户注册"""
    import uuid
    
    # 检查邮箱是否已存在
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 创建用户
    user_id = f"user_{uuid.uuid4()}"
    user = User(
        id=user_id,
        name=user_data.name,
        email=user_data.email,
        email_verified=False
    )
    db.add(user)
    
    # 创建账户（存储密码）
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    account = Account(
        id=f"account_{uuid.uuid4()}",
        account_id=user_data.email,
        provider_id="email",
        user_id=user_id,
        password=hashed_password.decode('utf-8')
    )
    db.add(account)
    
    # 创建会话
    session_token = secrets.token_urlsafe(32)
    session = Session(
        id=f"session_{uuid.uuid4()}",
        token=session_token,
        user_id=user_id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(session)
    
    db.commit()
    db.refresh(user)
    db.refresh(session)
    
    return {
        "token": session.token,
        "expires_at": session.expires_at,
        "user": user
    }


@router.post("/login", response_model=SessionResponse)
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """用户登录"""
    import uuid
    
    # 查找用户
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 验证密码
    account = db.query(Account).filter(
        Account.user_id == user.id,
        Account.provider_id == "email"
    ).first()
    
    if not account or not account.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(login_data.password.encode('utf-8'), account.password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 创建新会话
    session_token = secrets.token_urlsafe(32)
    session = Session(
        id=f"session_{uuid.uuid4()}",
        token=session_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "token": session.token,
        "expires_at": session.expires_at,
        "user": user
    }


@router.get("/session/{token}", response_model=UserResponse)
async def get_session(
    token: str,
    db: Session = Depends(get_db)
):
    """获取会话用户信息"""
    session = db.query(Session).filter(
        Session.token == token,
        Session.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.delete("/logout")
async def logout(
    token: str,
    db: Session = Depends(get_db)
):
    """用户登出"""
    session = db.query(Session).filter(Session.token == token).first()
    if session:
        db.delete(session)
        db.commit()
    
    return {"message": "Logged out successfully"}


