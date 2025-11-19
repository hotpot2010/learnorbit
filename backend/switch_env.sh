#!/bin/bash

echo "=========================================="
echo "🔄 环境配置切换工具"
echo "=========================================="
echo ""
echo "请选择环境："
echo "1. 本地开发环境 (localhost:8001)"
echo "2. 线上生产环境 (https://learnorbit.gaotu.cn)"
echo "3. 查看当前配置"
echo "0. 退出"
echo ""
read -p "请输入选项 (0-3): " choice

case $choice in
  1)
    echo ""
    echo "📝 切换到本地开发环境..."
    if [ -f "env.local.example" ]; then
      cp env.local.example .env
      echo "✅ 已切换到本地开发环境"
      echo "📍 API_PROXY_URL=http://localhost:8001"
    else
      echo "❌ 错误: env.local.example 文件不存在"
    fi
    ;;
  2)
    echo ""
    echo "📝 切换到线上生产环境..."
    if [ -f "env.production.example" ]; then
      cp env.production.example .env
      echo "✅ 已切换到线上生产环境"
      echo "📍 API_PROXY_URL=https://learnorbit.gaotu.cn"
    else
      echo "❌ 错误: env.production.example 文件不存在"
    fi
    ;;
  3)
    echo ""
    echo "📊 当前配置："
    echo "=========================================="
    if [ -f ".env" ]; then
      grep "API_PROXY_URL" .env || true
      grep "LLM_PROVIDER" .env || true
      grep "DEBUG" .env || true
    else
      echo "⚠️  .env 文件不存在"
    fi
    echo "=========================================="
    ;;
  0)
    echo "👋 退出"
    exit 0
    ;;
  *)
    echo "❌ 无效选项"
    ;;
esac

echo ""


