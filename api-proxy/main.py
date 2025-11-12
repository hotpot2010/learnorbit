"""
API 转发服务
统一转发 ASR、LLM、文件上传等外部接口请求
"""
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx
import os
from typing import Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI(
    title="API Proxy Service",
    description="统一转发 ASR、LLM、文件上传接口",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 配置 ====================

# ASR 配置
ASR_APP_ID = os.getenv("ASR_APP_ID", "1728")
ASR_APP_KEY = os.getenv("ASR_APP_KEY", "09450965e796431cb730d04b7b784c76")
ASR_BASE_URL = "https://tech.baijia.com/ai/tool/asr/async"

# LLM 配置
LLM_API_KEY = os.getenv("BAIJIA_API_KEY", "sk-7BfuPhPxtPMjaAJn86vR2g")
LLM_BASE_URL = "https://llm.baijia.com/v1/chat/completions"

# 文件上传配置
FILE_UPLOAD_URL = "http://internal-storage.genshuixue.com/webupload.php"
FILE_UPLOAD_UID = os.getenv("FILE_UPLOAD_UID", "20210716")

# HTTP 客户端配置
timeout = httpx.Timeout(300.0, connect=60.0)
client = httpx.AsyncClient(timeout=timeout)

# ==================== 健康检查 ====================

@app.get("/")
async def root():
    """健康检查"""
    return {
        "service": "API Proxy Service",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "asr_create": "/asr/create",
            "asr_get": "/asr/get",
            "llm_chat": "/llm/chat",
            "file_upload": "/upload"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "message": "API Proxy Service is running"}

@app.get("/", response_class=HTMLResponse)
async def root():
    """根路径重定向到测试页面"""
    return FileResponse("test.html")

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """测试页面"""
    return FileResponse("test.html")

# ==================== ASR 接口 ====================

@app.post("/asr/create")
async def asr_create(request: Request):
    """
    创建 ASR 异步任务
    转发到: https://tech.baijia.com/ai/tool/asr/async/create
    """
    try:
        # 获取请求体
        body = await request.json()
        
        # 添加认证信息
        if "appId" not in body:
            body["appId"] = int(ASR_APP_ID)
        
        # 添加 app_key 到请求头
        headers = {
            "Content-Type": "application/json",
            "app-key": ASR_APP_KEY
        }
        
        print(f"📝 ASR Create Request: {body}")
        
        # 转发请求
        response = await client.post(
            f"{ASR_BASE_URL}/create",
            json=body,
            headers=headers
        )
        
        print(f"✅ ASR Create Response: {response.status_code}")
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json()
        )
        
    except Exception as e:
        print(f"❌ ASR Create Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/asr/get")
async def asr_get(id: str):
    """
    获取 ASR 任务结果
    转发到: https://tech.baijia.com/ai/tool/asr/async/getById
    """
    try:
        # 添加 app_key 到请求头
        headers = {
            "app-key": ASR_APP_KEY
        }
        
        print(f"📝 ASR Get Request: id={id}")
        
        # 转发请求
        response = await client.get(
            f"{ASR_BASE_URL}/getById",
            params={"id": id},
            headers=headers
        )
        
        print(f"✅ ASR Get Response: {response.status_code}")
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json()
        )
        
    except Exception as e:
        print(f"❌ ASR Get Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LLM 接口 ====================

@app.post("/llm/chat")
async def llm_chat(request: Request):
    """
    LLM 聊天接口
    转发到: https://llm.baijia.com/v1/chat/completions
    """
    try:
        # 获取请求体
        body = await request.json()
        
        # 添加认证 Header
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LLM_API_KEY}"
        }
        
        print(f"🤖 LLM Chat Request: model={body.get('model', 'N/A')}, messages={len(body.get('messages', []))}")
        
        # 转发请求
        response = await client.post(
            LLM_BASE_URL,
            json=body,
            headers=headers
        )
        
        print(f"✅ LLM Chat Response: {response.status_code}")
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json()
        )
        
    except Exception as e:
        print(f"❌ LLM Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 文件上传接口 ====================

@app.post("/upload")
async def file_upload(
    files: list[UploadFile] = File(...),
    uid: Optional[str] = Form(None)
):
    """
    文件上传接口
    转发到: http://internal-storage.genshuixue.com/webupload.php
    """
    try:
        # 使用传入的 uid 或默认值
        upload_uid = uid or FILE_UPLOAD_UID
        
        # 准备表单数据
        form_data = {"uid": upload_uid}
        
        # 准备文件
        files_dict = {}
        for idx, file in enumerate(files):
            file_key = f"file{idx}"
            file_content = await file.read()
            files_dict[file_key] = (file.filename, file_content, file.content_type)
        
        print(f"📤 File Upload Request: {len(files)} file(s), uid={upload_uid}")
        
        # 转发请求
        response = await client.post(
            FILE_UPLOAD_URL,
            data=form_data,
            files=files_dict
        )
        
        print(f"✅ File Upload Response: {response.status_code}")
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json()
        )
        
    except Exception as e:
        print(f"❌ File Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 启动和关闭事件 ====================

@app.on_event("startup")
async def startup_event():
    """启动事件"""
    print("=" * 60)
    print("🚀 API Proxy Service Started")
    print("=" * 60)
    print(f"📍 ASR Service: {ASR_BASE_URL}")
    print(f"📍 LLM Service: {LLM_BASE_URL}")
    print(f"📍 File Upload: {FILE_UPLOAD_URL}")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    await client.aclose()
    print("👋 API Proxy Service Stopped")

# ==================== 运行服务 ====================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8001"))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )



