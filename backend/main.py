"""
FastAPI Video Analysis Service
Main application entry point
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.staticfiles import StaticFiles
import uvicorn

# 尝试导入配置和路由，如果失败则使用简化模式
try:
    from app.core.config import settings
    SETTINGS_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 配置模块导入失败: {e}")
    SETTINGS_AVAILABLE = False
    # 创建简化配置
    class SimpleSettings:
        HOST = "0.0.0.0"
        PORT = 8000
        DEBUG = True
        CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
    settings = SimpleSettings()

try:
    from app.api.routes import video
    VIDEO_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 视频路由模块导入失败: {e}")
    print("💡 将以简化模式运行，不包含AI分析功能")
    VIDEO_ROUTES_AVAILABLE = False

try:
    from app.api.routes import batch_analysis
    BATCH_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 批量分析路由模块导入失败: {e}")
    print("💡 批量分析功能不可用")
    BATCH_ROUTES_AVAILABLE = False

try:
    from app.api.routes import notes
    NOTES_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 笔记路由模块导入失败: {e}")
    print("💡 笔记生成功能不可用")
    NOTES_ROUTES_AVAILABLE = False

try:
    from app.api.routes import video_search
    VIDEO_SEARCH_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 视频搜索路由模块导入失败: {e}")
    print("💡 视频搜索功能不可用")
    VIDEO_SEARCH_ROUTES_AVAILABLE = False

try:
    from app.api.routes import file_upload
    FILE_UPLOAD_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 文件上传路由模块导入失败: {e}")
    print("💡 文件上传功能不可用")
    FILE_UPLOAD_ROUTES_AVAILABLE = False

try:
    from app.api.routes import offline_video
    OFFLINE_VIDEO_ROUTES_AVAILABLE = True
except Exception as e:
    print(f"⚠️ 离线视频处理路由模块导入失败: {e}")
    print("💡 离线视频处理功能不可用")
    OFFLINE_VIDEO_ROUTES_AVAILABLE = False

# Create FastAPI application
app = FastAPI(
    title="Video Analysis API",
    description="AI-powered video content analysis using Gemini API",
    version="1.0.0",
    openapi_version="3.0.2",  # 明确指定OpenAPI版本
    docs_url=None,  # 禁用默认docs
    redoc_url=None  # 禁用默认redoc
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加中间件过滤轮询请求的访问日志
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
import logging

class PollingLogFilterMiddleware(BaseHTTPMiddleware):
    """过滤轮询请求的访问日志"""
    
    async def dispatch(self, request: StarletteRequest, call_next):
        # 检查是否是轮询请求
        is_polling = (
            request.url.path == "/open-api/offline-video/tasks" and
            request.query_params.get("poll") == "true"
        )
        
        if is_polling:
            # 临时禁用访问日志
            access_logger = logging.getLogger("uvicorn.access")
            original_level = access_logger.level
            access_logger.setLevel(logging.WARNING)  # 只记录警告及以上级别
        
        try:
            response = await call_next(request)
            return response
        finally:
            if is_polling:
                # 恢复日志级别
                access_logger.setLevel(original_level)

app.add_middleware(PollingLogFilterMiddleware)

# Mount static files for CDN service
import os
static_dir = "uploads/public"
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
print(f"📁 Static files mounted: /static -> {static_dir}")

# Include API routes (如果可用) - 所有路由统一添加 /open-api 前缀
if VIDEO_ROUTES_AVAILABLE:
    app.include_router(video.router, prefix="/open-api")
    print("✅ 视频分析功能已启用 (/open-api/api/v1/video)")
else:
    print("⚠️ 视频分析功能不可用，仅提供基础API")

if BATCH_ROUTES_AVAILABLE:
    app.include_router(batch_analysis.router, prefix="/open-api")
    print("✅ 批量分析功能已启用 (/open-api/batch)")
else:
    print("⚠️ 批量分析功能不可用")

if NOTES_ROUTES_AVAILABLE:
    app.include_router(notes.router, prefix="/open-api/notes", tags=["notes"])
    print("✅ 笔记生成功能已启用 (/open-api/notes)")
else:
    print("⚠️ 笔记生成功能不可用")

if VIDEO_SEARCH_ROUTES_AVAILABLE:
    app.include_router(video_search.router, prefix="/open-api/video-search", tags=["video-search"])
    print("✅ 视频搜索功能已启用 (/open-api/video-search)")
else:
    print("⚠️ 视频搜索功能不可用")

if FILE_UPLOAD_ROUTES_AVAILABLE:
    app.include_router(file_upload.router, prefix="/open-api", tags=["file-upload"])
    print("✅ 文件上传功能已启用 (/open-api/upload)")
else:
    print("⚠️ 文件上传功能不可用")

if OFFLINE_VIDEO_ROUTES_AVAILABLE:
    try:
        app.include_router(offline_video.router, prefix="/open-api", tags=["offline-video"])
        print("✅ 离线视频处理功能已启用 (/open-api/offline-video)")
        
        # 添加数据库查看器路由
        try:
            from app.api.routes import db_viewer
            app.include_router(db_viewer.router, prefix="/open-api", tags=["db-viewer"])
            print("✅ 数据库查看器已启用 (/open-api/db-viewer)")
        except Exception as e:
            print(f"⚠️ 数据库查看器模块导入失败: {e}")
            import traceback
            traceback.print_exc()
    except Exception as e:
        print(f"❌ 离线视频处理路由注册失败: {e}")
        import traceback
        traceback.print_exc()
else:
    print("⚠️ 离线视频处理功能不可用")

# 自定义OpenAPI规范
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = {
        "openapi": "3.0.2",
        "info": {
            "title": app.title,
            "version": app.version,
            "description": app.description,
        },
        "servers": [
            {"url": "http://localhost:8000", "description": "本地开发服务器"},
        ],
        "paths": {},
        "components": {
            "schemas": {}
        }
    }
    
    # 获取FastAPI自动生成的OpenAPI规范
    from fastapi.openapi.utils import get_openapi
    auto_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # 合并路径和组件
    openapi_schema["paths"] = auto_schema.get("paths", {})
    openapi_schema["components"] = auto_schema.get("components", {})
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Root endpoint - HTML welcome page
@app.get("/offline-video", response_class=HTMLResponse)
async def offline_video_page():
    """离线视频处理页面"""
    import os
    template_path = os.path.join(os.path.dirname(__file__), "templates", "offline-video.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read())
    else:
        return HTMLResponse(content="<h1>页面未找到</h1>", status_code=404)

@app.get("/db-viewer", response_class=HTMLResponse)
async def db_viewer_page():
    """数据库查看器页面"""
    import os
    template_path = os.path.join(os.path.dirname(__file__), "templates", "db-viewer.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read())
    else:
        return HTMLResponse(content="<h1>页面未找到</h1>", status_code=404)

@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint with HTML welcome page"""
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Analysis API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 3rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 600px;
                margin: 2rem;
            }
            h1 {
                color: #333;
                margin-bottom: 1rem;
                font-size: 2.5rem;
            }
            .subtitle {
                color: #666;
                font-size: 1.2rem;
                margin-bottom: 2rem;
            }
            .status {
                background: #10B981;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 25px;
                display: inline-block;
                margin-bottom: 2rem;
                font-weight: bold;
            }
            .links {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-top: 2rem;
            }
            .link-card {
                background: #f8fafc;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                padding: 1.5rem;
                text-decoration: none;
                color: #334155;
                transition: all 0.3s ease;
            }
            .link-card:hover {
                border-color: #667eea;
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            }
            .link-title {
                font-weight: bold;
                font-size: 1.1rem;
                margin-bottom: 0.5rem;
                color: #1e293b;
            }
            .link-desc {
                font-size: 0.9rem;
                color: #64748b;
            }
            .emoji {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 Video Analysis API</h1>
            <p class="subtitle">基于 Gemini AI 的智能视频内容分析服务</p>
            <div class="status">🟢 服务运行中</div>
            
            <div class="links">
                <a href="/docs" class="link-card">
                    <div class="emoji">📚</div>
                    <div class="link-title">API 文档</div>
                    <div class="link-desc">交互式 API 文档和测试界面</div>
                </a>
                
                <a href="/redoc" class="link-card">
                    <div class="emoji">📖</div>
                    <div class="link-title">ReDoc 文档</div>
                    <div class="link-desc">另一种风格的 API 文档</div>
                </a>
                
                <a href="/api/v1/video/health" class="link-card">
                    <div class="emoji">💚</div>
                    <div class="link-title">健康检查</div>
                    <div class="link-desc">查看服务运行状态</div>
                </a>
                
                <a href="/api/v1/video/analysis-types" class="link-card">
                    <div class="emoji">🔍</div>
                    <div class="link-title">分析类型</div>
                    <div class="link-desc">查看支持的分析类型</div>
                </a>
                
                <a href="/docs-offline" class="link-card">
                    <div class="emoji">📄</div>
                    <div class="link-title">离线文档</div>
                    <div class="link-desc">无需网络的API文档</div>
                </a>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9rem;">
                <p><strong>版本:</strong> 1.0.0 | <strong>端口:</strong> 8000</p>
                <p>💡 点击上方链接开始使用 API 服务</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

# JSON API endpoint
@app.get("/open-api")
@app.get("/open-api/")
async def api_info():
    """JSON API information endpoint"""
    return {
        "message": "Video Analysis API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/open-api/api/v1/video/health"
    }

# 如果视频路由不可用，提供备用端点
if not VIDEO_ROUTES_AVAILABLE:
    @app.get("/open-api/api/v1/video/health")
    async def fallback_health():
        """备用健康检查端点"""
        return {
            "status": "degraded",
            "message": "基础服务运行中，AI分析功能不可用",
            "timestamp": "2024-01-01T00:00:00",
            "note": "请检查依赖安装或使用简化版本"
        }
    
    @app.get("/open-api/api/v1/video/analysis-types")
    async def fallback_analysis_types():
        """备用分析类型端点"""
        return {
            "analysis_types": [],
            "descriptions": {},
            "note": "AI分析功能不可用，请检查Gemini API配置"
        }
    
    @app.post("/open-api/api/v1/video/upload-and-analyze")
    async def fallback_upload():
        """备用上传端点"""
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="AI分析功能不可用。请安装完整依赖或配置GEMINI_API_KEY"
        )

# OpenAPI JSON端点
@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_json():
    """获取OpenAPI JSON规范"""
    return app.openapi()

# 自定义文档端点 - 使用本地CDN
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """自定义Swagger UI，使用国内CDN"""
    return get_swagger_ui_html(
        openapi_url="/openapi.json",  # 使用我们自定义的OpenAPI端点
        title=app.title + " - API文档",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdn.bootcdn.net/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js",
        swagger_css_url="https://cdn.bootcdn.net/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css",
    )

@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    """自定义ReDoc，使用国内CDN"""
    return get_redoc_html(
        openapi_url="/openapi.json",  # 使用我们自定义的OpenAPI端点
        title=app.title + " - ReDoc文档",
        redoc_js_url="https://cdn.bootcdn.net/ajax/libs/redoc/2.0.0/bundles/redoc.standalone.js",
    )

@app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect():
    return get_swagger_ui_oauth2_redirect_html()

# 备用文档端点 - 使用内嵌HTML（完全离线）
@app.get("/docs-offline", include_in_schema=False)
async def offline_docs():
    """离线版API文档"""
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Video Analysis API - 离线文档</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .method { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; }
            .get { background-color: #61affe; }
            .post { background-color: #49cc90; }
            .path { font-family: monospace; font-size: 16px; margin: 10px 0; }
            .description { color: #666; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>🎬 Video Analysis API - 离线文档</h1>
        <p>如果在线文档无法加载，可以使用此离线版本查看API端点。</p>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <div class="path">/</div>
            <div class="description">主页 - HTML欢迎页面</div>
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <div class="path">/api</div>
            <div class="description">API信息 - JSON格式</div>
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <div class="path">/api/v1/video/health</div>
            <div class="description">健康检查 - 查看服务状态</div>
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <div class="path">/api/v1/video/analysis-types</div>
            <div class="description">分析类型 - 获取支持的视频分析类型</div>
        </div>
        
        <div class="endpoint">
            <span class="method post">POST</span>
            <div class="path">/api/v1/video/upload-and-analyze</div>
            <div class="description">上传分析 - 上传视频文件并进行AI分析</div>
        </div>
        
        <div class="endpoint">
            <span class="method post">POST</span>
            <div class="path">/api/v1/video/analyze-by-path</div>
            <div class="description">路径分析 - 通过文件路径分析本地视频</div>
        </div>
        
        <h2>📝 使用说明</h2>
        <ul>
            <li>所有POST请求需要在请求体中包含相应的JSON数据</li>
            <li>视频分析功能需要配置GEMINI_API_KEY环境变量</li>
            <li>支持的视频格式：MP4, AVI, MOV, MKV, WebM等</li>
            <li>最大上传文件大小：100MB</li>
        </ul>
        
        <h2>🔗 相关链接</h2>
        <ul>
            <li><a href="/docs">在线API文档 (Swagger UI)</a></li>
            <li><a href="/redoc">ReDoc文档</a></li>
            <li><a href="/api/v1/video/health">健康检查</a></li>
        </ul>
    </body>
    </html>
    """)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    print(f"❌ Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    print("🚀 Starting Video Analysis API Server...")
    print(f"📍 Server will run on: http://{settings.HOST}:{settings.PORT}")
    print(f"📚 API Documentation: http://{settings.HOST}:{settings.PORT}/docs")
    
    if VIDEO_ROUTES_AVAILABLE:
        print("✅ 完整功能模式 - 包含AI视频分析")
    else:
        print("⚠️ 简化功能模式 - 仅基础API服务")
    
    # 使用单进程模式避免multiprocessing问题
    uvicorn.run(
        app,  # 直接传递app对象而不是字符串
        host=settings.HOST,
        port=settings.PORT,
        reload=False,  # 禁用自动重载避免multiprocessing
        workers=1,     # 单进程模式
        log_level="info"
    )
