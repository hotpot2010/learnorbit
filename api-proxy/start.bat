@echo off
REM API 转发服务启动脚本 (Windows)

echo 🚀 启动 API 转发服务...

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Python 未安装
    pause
    exit /b 1
)

REM 安装依赖
echo 📦 安装依赖...
pip install -r requirements.txt

REM 检查 .env 文件
if not exist ".env" (
    echo ⚠️  警告: .env 文件不存在，将使用默认配置
    echo 提示: 复制 env.example 为 .env 并修改配置
)

REM 启动服务
echo 🎬 启动服务...
python main.py

pause



