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
            content_type = request.headers.get("content-type", "").lower()
            
            print(f"📋 Request Content-Type: {content_type}")
            print(f"📋 Request path: {path}")
            
            # 对于 /upload 路径，直接转发原始 body，避免解析错误
            # 这样可以确保文件上传请求能够正确转发
            is_upload_path = path.endswith("/upload") or "/upload" in path
            
            if is_upload_path:
                # 对于上传路径，直接读取原始 body 并转发，不进行解析
                print(f"📤 Processing upload path: forwarding raw body")
                try:
                    body = await request.body()
                    print(f"📦 Body size: {len(body)} bytes")
                    print(f"📋 Original Content-Type: {content_type}")
                    
                    # 如果 Content-Type 已经是 multipart/form-data，直接使用（不要修改）
                    if 'multipart/form-data' in content_type:
                        # 使用原始的 Content-Type，确保 boundary 完全匹配
                        headers["Content-Type"] = request.headers.get("content-type", content_type)
                        print(f"✅ 使用原始 Content-Type: {headers['Content-Type']}")
                    else:
                        # Content-Type 不是 multipart，需要检测并修复
                        # 检查 body 是否包含 multipart boundary
                        body_str = body[:500].decode('utf-8', errors='ignore') if len(body) > 0 else ''
                        has_multipart_boundary = 'Content-Disposition' in body_str or body_str.startswith('------')
                        
                        if has_multipart_boundary:
                            print(f"⚠️  检测到 multipart 数据但 Content-Type 错误，尝试修复")
                            import re
                            boundary = None
                            
                            # 方法1: 从 body 开头直接提取 boundary（最准确）
                            # multipart body 格式: --boundary\r\nContent-Disposition...
                            # 注意：body 中可能有多个短横线，但 boundary 值本身不包含前导的 --
                            if body_str.startswith('--'):
                                # 提取第一个 boundary（去掉前导的 --）
                                match = re.match(r'^--+([^\r\n]+)', body_str)
                                if match:
                                    boundary = match.group(1).strip()
                                    # 验证 boundary 格式（不应该包含前导的 --）
                                    if boundary.startswith('--'):
                                        boundary = boundary.lstrip('-')
                                    print(f"📌 从 body 开头提取 boundary: {boundary}")
                                    print(f"📋 Body 开头预览: {body_str[:100]}")
                            
                            # 方法2: 从 Content-Disposition 中查找 boundary
                            if not boundary:
                                boundary_pattern = r'boundary=([^\s;,\r\n]+)'
                                match = re.search(boundary_pattern, body_str)
                                if match:
                                    boundary = match.group(1).strip('"\'')
                                    print(f"📌 从 Content-Disposition 提取 boundary: {boundary}")
                            
                            # 方法3: 从 body 中查找所有可能的 boundary 标记
                            if not boundary:
                                # 查找所有 --boundary 模式
                                matches = re.findall(r'^--+([^\r\n]+)', body_str, re.MULTILINE)
                                if matches:
                                    # 使用第一个匹配的 boundary
                                    boundary = matches[0].strip()
                                    print(f"📌 从 body 中提取 boundary: {boundary}")
                            
                            if boundary:
                                headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
                                print(f"✅ 修复 Content-Type: {headers['Content-Type']}")
                            else:
                                # 如果找不到 boundary，尝试使用原始 Content-Type（如果存在）
                                original_ct = request.headers.get("content-type", "")
                                if 'multipart' in original_ct.lower():
                                    headers["Content-Type"] = original_ct
                                    print(f"⚠️  无法提取 boundary，使用原始 Content-Type: {original_ct}")
                                else:
                                    headers["Content-Type"] = "multipart/form-data"
                                    print(f"⚠️  无法提取 boundary，使用默认 Content-Type")
                        else:
                            # 没有检测到 multipart，保持原始 Content-Type
                            headers["Content-Type"] = request.headers.get("content-type", content_type)
                            print(f"📋 未检测到 multipart，保持原始 Content-Type: {headers['Content-Type']}")
                    
                    # 确保 content-type 头存在
                    if "Content-Type" not in headers:
                        headers["Content-Type"] = request.headers.get("content-type", "multipart/form-data")
                    
                    print(f"📤 转发请求，Content-Type: {headers.get('Content-Type', 'N/A')}")
                    
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        content=body
                    )
                except Exception as e:
                    print(f"❌ Error forwarding upload request: {e}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error forwarding file upload: {str(e)}"
                    )
            elif "multipart/form-data" in content_type:
                # 处理其他 multipart/form-data 请求（非上传路径）
                print(f"📤 Processing as multipart/form-data")
                try:
                    form_data = await request.form()
                    files = []
                    data = {}
                    
                    print(f"📦 Form fields count: {len(form_data)}")
                    for key, value in form_data.items():
                        if isinstance(value, UploadFile):
                            # 读取文件内容
                            file_content = await value.read()
                            files.append((key, (value.filename, file_content, value.content_type)))
                            print(f"   📎 File: {key} = {value.filename} ({len(file_content)} bytes)")
                        else:
                            data[key] = value
                            print(f"   📝 Data: {key} = {str(value)[:100]}")
                    
                    print(f"📤 Forwarding: {len(files)} file(s), {len(data)} data field(s)")
                    
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
                except Exception as e:
                    print(f"❌ Error processing multipart/form-data: {e}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error processing multipart/form-data: {str(e)}"
                    )
            elif "application/json" in content_type:
                # JSON 请求
                print(f"📋 Processing as JSON request")
                try:
                    body = await request.json()
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        json=body
                    )
                except Exception as e:
                    print(f"❌ Error parsing JSON: {e}")
                    import traceback
                    traceback.print_exc()
                    # 如果 JSON 解析失败，尝试作为原始内容发送
                    try:
                        body = await request.body()
                        response = await client.request(
                            method=request.method,
                            url=target_url,
                            headers=headers,
                            content=body
                        )
                    except Exception as e2:
                        print(f"❌ Error sending raw body: {e2}")
                        raise HTTPException(
                            status_code=400,
                            detail=f"Error processing request body: {str(e)}"
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

