"""
文件上传透传路由
透传 api-proxy 的文件上传接口给外部使用
"""
import os
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

router = APIRouter(tags=["file-upload"])

# API Proxy 配置
API_PROXY_URL = os.getenv("API_PROXY_URL", "http://localhost:8001")
PROXY_UPLOAD_URL = f"{API_PROXY_URL}/open-api/upload"

# HTTP 客户端配置（文件上传可能需要较长时间）
timeout = httpx.Timeout(300.0, connect=60.0)
client = httpx.AsyncClient(timeout=timeout)


@router.post("/upload")
async def file_upload_proxy(request: Request):
    """
    文件上传透传接口
    透传到 api-proxy 的文件上传接口
    
    支持单文件和多文件上传
    请求格式: multipart/form-data
    参数:
    - files: 文件字段（可以是 file0, file1, ... 或任意字段名）
    - uid: 可选，上传用户ID，默认为 api-proxy 的默认值
    """
    try:
        print(f"📤 File upload proxy request received")
        print(f"📍 Target: {PROXY_UPLOAD_URL}")
        
        # 解析 multipart/form-data
        form = await request.form()
        
        # 准备转发给 api-proxy 的表单数据
        form_data = {}
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
                print(f"📎 File: {field_name} = {field_value.filename} ({len(file_content)} bytes)")
            else:
                # 非文件字段
                form_data[field_name] = str(field_value)
                print(f"📝 Form field: {field_name} = {str(field_value)[:100]}")
        
        if file_count == 0:
            raise HTTPException(status_code=400, detail="No files provided")
        
        print(f"📊 Forwarding: {file_count} file(s), {len(form_data)} form field(s)")
        
        # 转发请求到 api-proxy
        try:
            response = await client.post(
                PROXY_UPLOAD_URL,
                data=form_data,
                files=files_dict
            )
            
            print(f"✅ Proxy response: {response.status_code}")
            
            # 如果响应状态码不是 2xx，记录详细信息
            if response.status_code >= 400:
                print(f"⚠️  Error response from proxy:")
                print(f"   Status: {response.status_code}")
                print(f"   Response: {response.text[:500]}")
            
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
                    content={"detail": response.text}
                )
                
        except httpx.HTTPStatusError as e:
            print(f"❌ HTTP Status Error: {e}")
            print(f"   Response status: {e.response.status_code}")
            print(f"   Response text: {e.response.text[:500]}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Proxy service error: {e.response.text[:200]}"
            )
        except httpx.RequestError as e:
            print(f"❌ Request Error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to proxy service: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ File upload proxy error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

