"""
ASR (Automatic Speech Recognition) 模型定义
"""
from pydantic import BaseModel
from typing import List, Optional


class AsrCreate(BaseModel):
    """ASR创建模型"""
    appId: int
    contentScenario: int
    bizId: str
    content: str
    contentSource: str
    contentType: int
    creator: str


class CommunicationDetail(BaseModel):
    """沟通详情模型"""
    role: str
    words: str
    begin: int
    end: int


class AsrTaskProItem(BaseModel):
    """ASR任务处理结果项模型"""
    speaker: str
    msg: str


class AsrAsyncTaskContentAttribute(BaseModel):
    """ASR异步任务结果模型"""
    taskId: int
    audioUrl: str
    asrTaskResult: str
    asrTaskProResult: List[AsrTaskProItem]
    asrRawContent: str
    communicationDetailList: List[CommunicationDetail]


class AsrAsyncTaskResult(BaseModel):
    """ASR异步任务结果模型"""
    id: int
    appId: int
    contentScenario: int
    bizId: str
    contentType: int
    contentHash: str
    originalContent: str
    content: str
    contentAttribute: str
    finalContent: str
    contentSource: str
    contentStatus: str
    reviewStatus: str
    ext: str
    creator: str
    updater: str
    createTime: str
    updateTime: str
    isDel: int
    dimensionList: List[str]
