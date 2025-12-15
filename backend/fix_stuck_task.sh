#!/bin/bash
# 一键修复卡在"执行中"的任务
# 适用于 Linux/Mac

TASK_ID=${1:-"task_1764906207_1200"}

echo "🚀 一键修复卡住的任务"
echo "   任务ID: $TASK_ID"
echo "========================================"
echo ""

# 步骤1: 强制修复数据库状态
echo "📊 步骤1: 强制修复数据库状态..."
python force_fix_task_status.py $TASK_ID

if [ $? -ne 0 ]; then
    echo "❌ 修复数据库状态失败"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ 修复完成!"
echo ""
echo "⚠️  接下来请手动执行:"
echo "   1. 重启后端服务 (Ctrl+C 然后重新运行)"
echo "   2. 在浏览器中强制刷新页面 (Ctrl+Shift+R)"
echo "   3. 如果仍显示'执行中'，清除浏览器缓存:"
echo "      Chrome: F12 -> Network -> Disable cache"
echo "      然后再刷新页面"
echo "========================================"



