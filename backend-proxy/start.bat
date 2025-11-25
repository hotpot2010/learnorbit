@echo off
REM Backend Proxy Service 启动脚本 (Windows)

echo 🚀 Starting Backend Proxy Service...

REM 检查虚拟环境
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 安装依赖
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM 启动服务
echo ✅ Starting proxy service...
python main.py

