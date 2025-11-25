#!/bin/bash

# Backend Proxy Service 启动脚本

echo "🚀 Starting Backend Proxy Service..."

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# 启动服务
echo "✅ Starting proxy service..."
python main.py

