"""
最小化FastAPI应用 - 避免所有复杂依赖
"""
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI(title="Video Analysis API - Minimal")

@app.get("/", response_class=HTMLResponse)
def root():
    return """
    <html>
        <head><title>Video Analysis API - 运行中</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🎬 Video Analysis API</h1>
            <p>✅ 服务器运行正常</p>
            <p>这是最小化版本，用于测试基础功能</p>
            <a href="/test">测试端点</a>
        </body>
    </html>
    """

@app.get("/test")
def test():
    return {"status": "ok", "message": "服务器运行正常"}

if __name__ == "__main__":
    print("🚀 启动最小化服务器...")
    print("📍 访问: http://localhost:8000")
    
    # 使用单进程模式避免multiprocessing问题
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        workers=1,  # 单进程
        reload=False  # 禁用自动重载
    )

