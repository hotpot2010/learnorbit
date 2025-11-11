#!/bin/bash

# API 转发服务启动脚本

echo "🚀 启动 API 转发服务..."

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: Python 3 未安装"
    exit 1
fi

# 检查是否在虚拟环境中
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  警告: 未在虚拟环境中运行"
    echo "建议: 先运行 'python3 -m venv venv && source venv/bin/activate'"
fi

# 安装依赖
echo "📦 安装依赖..."
pip install -r requirements.txt

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: .env 文件不存在，将使用默认配置"
    echo "提示: 复制 env.example 为 .env 并修改配置"
fi

# 启动服务
echo "🎬 启动服务..."
python main.py

