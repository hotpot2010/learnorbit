"""
最简单的FastAPI测试
"""
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello World", "status": "working"}

@app.get("/test")
def test_endpoint():
    return {"test": "success", "port": 8000}

if __name__ == "__main__":
    print("🧪 启动最简单的测试服务器...")
    print("📍 访问: http://localhost:8000")
    print("📍 测试: http://localhost:8000/test")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

