"""
API 转发服务
统一转发 ASR、LLM、文件上传等外部接口请求
"""
from fastapi import FastAPI, APIRouter, Request, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
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

# 创建路由器，添加统一的路径前缀
api_router = APIRouter(prefix="/open-api")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 异常处理器：捕获 FastAPI 的 422 验证错误
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理 FastAPI 的请求验证错误（422）"""
    print(f"❌ FastAPI Validation Error (422):")
    print(f"   URL: {request.url}")
    print(f"   Method: {request.method}")
    print(f"   Content-Type: {request.headers.get('content-type', 'N/A')}")
    print(f"   Headers: {dict(request.headers)}")
    print(f"   Errors: {exc.errors()}")
    
    # 尝试读取请求体（对于 multipart/form-data，可能无法读取）
    try:
        body = await request.body()
        body_preview = body[:500] if len(body) > 500 else body
        print(f"   Body preview (first 500 bytes): {body_preview[:500]}")
    except Exception as e:
        print(f"   Body: Cannot read (multipart/form-data or other): {e}")
        body_preview = None
    
    # 尝试解析 form 数据
    try:
        form = await request.form()
        print(f"   Form fields: {list(form.keys())}")
        for field_name, field_value in form.items():
            print(f"     - {field_name}: {type(field_value).__name__}")
    except Exception as e:
        print(f"   Form: Cannot parse: {e}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body_preview": str(body_preview) if body_preview else None,
            "message": "FastAPI validation error. Check server logs for details."
        }
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

# ==================== API 路由（使用 /open-api 前缀） ====================

@api_router.get("/")
async def api_info():
    """API 信息"""
    return {
        "service": "API Proxy Service",
        "status": "running",
        "version": "1.0.0",
        "base_path": "/open-api",
        "endpoints": {
            "health": "/open-api/health",
            "test": "/open-api/test",
            "asr_create": "/open-api/asr/create",
            "asr_get": "/open-api/asr/get",
            "llm_chat": "/open-api/llm/chat",
            "file_upload": "/open-api/upload"
        }
    }

@api_router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "message": "API Proxy Service is running"}

@api_router.get("/test", response_class=HTMLResponse)
async def test_page():
    """测试页面"""
    return FileResponse("test.html")

# ==================== ASR 接口 ====================

@api_router.post("/asr/create")
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

@api_router.get("/asr/get")
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

@api_router.post("/llm/chat")
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

@api_router.post("/upload")
async def file_upload(request: Request):
    """
    文件上传接口
    转发到: http://internal-storage.genshuixue.com/webupload.php
    支持单文件和多文件上传
    """
    try:
        # 解析 multipart/form-data
        form = await request.form()
        
        # 调试：打印所有接收到的字段
        print(f"🔍 Debug: Received form fields:")
        for field_name, field_value in form.items():
            field_type = type(field_value).__name__
            has_filename = hasattr(field_value, 'filename')
            print(f"   - {field_name}: type={field_type}, has_filename={has_filename}")
            if has_filename:
                print(f"     filename={field_value.filename}, content_type={getattr(field_value, 'content_type', 'N/A')}")
            else:
                print(f"     value={str(field_value)[:100]}")
        
        # 获取 uid（如果有）
        upload_uid = form.get("uid", FILE_UPLOAD_UID)
        
        # 准备表单数据
        form_data = {"uid": upload_uid}
        
        # 准备文件字典
        files_dict = {}
        file_count = 0
        
        # 遍历表单中的所有字段
        for field_name, field_value in form.items():
            # 检查是否是文件字段
            if hasattr(field_value, 'filename'):
                # 这是一个文件
                file_content = await field_value.read()
                files_dict[field_name] = (
                    field_value.filename,
                    file_content,
                    field_value.content_type or 'application/octet-stream'
                )
                file_count += 1
                print(f"📎 Found file: {field_name} = {field_value.filename} ({len(file_content)} bytes)")
            else:
                # 非文件字段，添加到 form_data（如果需要）
                if field_name != 'uid':  # uid 已经单独处理
                    form_data[field_name] = str(field_value)
        
        print(f"📊 Summary: {file_count} file(s), {len(form_data)} form field(s)")
        print(f"   Form fields: {list(form_data.keys())}")
        print(f"   File fields: {list(files_dict.keys())}")
        
        if file_count == 0:
            error_msg = f"No files provided. Received fields: {list(files_dict.keys())}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"📤 File Upload Request: {file_count} file(s), uid={upload_uid}")
        print(f"   Target URL: {FILE_UPLOAD_URL}")
        
        # 转发请求到目标服务
        try:
            response = await client.post(
                FILE_UPLOAD_URL,
                data=form_data,
                files=files_dict
            )
            
            print(f"✅ File Upload Response: {response.status_code}")
            response_text = response.text
            print(f"📦 Response content (first 500 chars): {response_text[:500]}")
            
            # 如果响应状态码不是 2xx，记录详细信息
            if response.status_code >= 400:
                print(f"⚠️  Error response from target service:")
                print(f"   Status: {response.status_code}")
                print(f"   Headers: {dict(response.headers)}")
                print(f"   Full response: {response_text}")
            
            # 尝试解析 JSON 响应
            try:
                response_json = response.json()
                return JSONResponse(
                    status_code=response.status_code,
                    content=response_json
                )
            except Exception as json_error:
                print(f"⚠️  Failed to parse JSON response: {json_error}")
                # 如果不是 JSON，返回文本响应
                return JSONResponse(
                    status_code=response.status_code,
                    content={"detail": response_text}
                )
        except httpx.HTTPStatusError as e:
            print(f"❌ HTTP Status Error: {e}")
            print(f"   Response status: {e.response.status_code}")
            print(f"   Response text: {e.response.text[:500]}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Target service error: {e.response.text[:200]}"
            )
        except httpx.RequestError as e:
            print(f"❌ Request Error: {e}")
            raise HTTPException(status_code=500, detail=f"Request to target service failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ File Upload Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 注册路由器 ====================

# 将 api_router 注册到 app，所有 API 路由都会有 /open-api 前缀
app.include_router(api_router)

# ==================== 启动和关闭事件 ====================

@app.on_event("startup")
async def startup_event():
    """启动事件"""
    print("=" * 60)
    print("🚀 API Proxy Service Started")
    print("=" * 60)
    print(f"📍 Base Path: /open-api")
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



