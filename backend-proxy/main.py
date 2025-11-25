"""
Backend API 转发服务
将所有请求转发到指定的后端服务器
"""
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI(
    title="Backend API Proxy Service",
    description="转发所有请求到后端服务器",
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

# 目标服务器配置
TARGET_SERVER = os.getenv("TARGET_SERVER", "http://172.20.240.235:8000")
PROXY_PORT = int(os.getenv("PROXY_PORT", "8002"))

# HTTP 客户端配置
timeout = httpx.Timeout(300.0, connect=60.0)
client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)

print(f"🚀 Backend Proxy Service initialized")
print(f"📍 Target server: {TARGET_SERVER}")
print(f"🌐 Proxy port: {PROXY_PORT}")


@app.get("/")
async def root():
    """根路径 - 返回服务信息"""
    return {
        "service": "Backend API Proxy Service",
        "status": "running",
        "version": "1.0.0",
        "target_server": TARGET_SERVER,
        "message": "所有请求将被转发到目标服务器"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    try:
        # 测试目标服务器连接
        response = await client.get(f"{TARGET_SERVER}/health", timeout=5.0)
        return {
            "status": "ok",
            "proxy": "running",
            "target_server": TARGET_SERVER,
            "target_status": response.status_code,
            "message": "Proxy and target server are both running"
        }
    except Exception as e:
        return {
            "status": "degraded",
            "proxy": "running",
            "target_server": TARGET_SERVER,
            "target_status": "unreachable",
            "error": str(e),
            "message": "Proxy is running but target server is unreachable"
        }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_request(path: str, request: Request):
    """
    通用代理路由 - 转发所有请求到目标服务器
    
    Args:
        path: 请求路径（包含查询参数）
        request: FastAPI Request 对象
    """
    try:
        # 构建目标URL
        target_url = f"{TARGET_SERVER}/{path}"
        
        # 如果有查询参数，添加到URL
        if request.url.query:
            target_url = f"{target_url}?{request.url.query}"
        
        print(f"🔄 [{request.method}] {request.url.path} -> {target_url}")
        
        # 获取请求头（排除一些不需要转发的头）
        headers = {}
        exclude_headers = {"host", "content-length", "connection", "transfer-encoding"}
        for key, value in request.headers.items():
            if key.lower() not in exclude_headers:
                headers[key] = value
        
        # 处理不同的请求方法
        if request.method in ["GET", "HEAD", "OPTIONS", "DELETE"]:
            # 简单请求，直接转发
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                params=request.query_params
            )
        elif request.method in ["POST", "PUT", "PATCH"]:
            # 需要处理请求体的请求
            content_type = request.headers.get("content-type", "")
            
            if "multipart/form-data" in content_type:
                # 处理文件上传
                form_data = await request.form()
                files = []
                data = {}
                
                for key, value in form_data.items():
                    if isinstance(value, UploadFile):
                        files.append((key, (value.filename, await value.read(), value.content_type)))
                    else:
                        data[key] = value
                
                if files:
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        files=files,
                        data=data
                    )
                else:
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        data=data
                    )
            elif "application/json" in content_type:
                # JSON 请求
                body = await request.json()
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    json=body
                )
            else:
                # 其他类型（如 application/x-www-form-urlencoded）
                body = await request.body()
                response = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body
                )
        else:
            # 其他方法
            body = await request.body()
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body if body else None
            )
        
        # 构建响应头（排除一些不需要的头）
        response_headers = {}
        exclude_response_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        for key, value in response.headers.items():
            if key.lower() not in exclude_response_headers:
                response_headers[key] = value
        
        # 处理响应内容
        content = response.content
        
        # 如果是流式响应
        if "stream" in response.headers.get("content-type", "").lower():
            return StreamingResponse(
                iter([content]),
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type")
            )
        
        # JSON响应
        try:
            json_content = response.json()
            return JSONResponse(
                content=json_content,
                status_code=response.status_code,
                headers=response_headers
            )
        except:
            # 非JSON响应
            return Response(
                content=content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type", "application/octet-stream")
            )
        
    except httpx.TimeoutException:
        print(f"❌ Request timeout: {target_url}")
        raise HTTPException(
            status_code=504,
            detail=f"Gateway timeout: Target server did not respond in time"
        )
    except httpx.ConnectError:
        print(f"❌ Connection error: Cannot connect to {TARGET_SERVER}")
        raise HTTPException(
            status_code=502,
            detail=f"Bad gateway: Cannot connect to target server {TARGET_SERVER}"
        )
    except Exception as e:
        print(f"❌ Proxy error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Proxy error: {str(e)}"
        )


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件 - 清理资源"""
    await client.aclose()
    print("👋 Backend Proxy Service stopped")


if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting Backend Proxy Service on port {PROXY_PORT}...")
    print(f"📍 All requests will be forwarded to: {TARGET_SERVER}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PROXY_PORT,
        log_level="info"
    )

