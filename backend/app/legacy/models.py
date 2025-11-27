from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(Integer, primary_key=True)
    chat_id = Column(String(100), nullable=False, index=True)
    content = Column(Text, nullable=False)
    doc_metadata = Column(Text, nullable=True)  # JSON formatted metadata
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Document {self.id} for chat {self.chat_id}>' 