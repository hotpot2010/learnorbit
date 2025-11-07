# 视频入口功能快速启动指南

## ❌ 当前问题

你遇到的 **404 错误** 是因为后端服务没有运行。

## ✅ 解决方案

### 第一步：启动后端服务

在新的终端窗口中运行：

```bash
# 方法1：直接启动（推荐）
cd D:\learnorbit\learnorbit\backend
python main.py
```

或者

```bash
# 方法2：使用虚拟环境
cd D:\learnorbit\learnorbit\backend
.venv\Scripts\activate
python main.py
```

### 预期输出

你应该看到类似这样的输出：

```
📁 Static files mounted: /static -> uploads/public
✅ 视频分析功能已启用
✅ 批量分析功能已启用
✅ 笔记生成功能已启用
✅ 视频搜索功能已启用  ← 这个是关键！
🚀 Starting Video Analysis API Server...
📍 Server will run on: http://0.0.0.0:8000
📚 API Documentation: http://0.0.0.0:8000/docs
✅ 完整功能模式 - 包含AI视频分析
INFO:     Started server process [xxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**关键检查点**:
- 必须看到 `✅ 视频搜索功能已启用`
- 如果看到 `⚠️ 视频搜索路由模块导入失败`，说明有错误

### 第二步：验证后端API

在另一个终端窗口中测试：

```bash
# 测试1：检查测试端点
curl http://localhost:8000/video-search/test

# 预期输出：
# {"status":"ok","message":"Video search API is running","endpoints":["POST /video-search/search - 搜索视频并分析"]}
```

或者在浏览器中访问：
```
http://localhost:8000/video-search/test
```

如果这个测试通过，说明后端正常运行！

### 第三步：测试完整搜索功能

```bash
curl -X POST http://localhost:8000/video-search/search \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Python基础教程\", \"limit\": 3}"
```

或者使用 PowerShell：

```powershell
$body = @{
    query = "Python基础教程"
    limit = 3
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/video-search/search" -Method Post -Body $body -ContentType "application/json"
```

### 第四步：测试前端

1. 确保前端也在运行：
```bash
npm run dev
```

2. 访问页面：
```
http://localhost:3000/zh/video-entry
```

3. 输入搜索关键词，点击"搜索视频"

## 🐛 常见问题排查

### 问题1：`ModuleNotFoundError: No module named 'bilibili_api'`

**原因**: bilibili-api 库未安装

**解决**:
```bash
pip install bilibili-api-python
```

### 问题2：`⚠️ 视频搜索路由模块导入失败`

**原因**: 可能是依赖缺失或代码错误

**排查步骤**:

1. 检查导入：
```bash
cd backend
python -c "from app.services.bilibili_search_service import bilibili_search_service; print('✅ 搜索服务OK')"
python -c "from app.services.video_analyzer_service import video_analyzer_service; print('✅ 分析服务OK')"
python -c "from app.api.routes.video_search import router; print('✅ 路由OK')"
```

2. 查看详细错误：
```bash
python main.py
# 查看启动时的错误信息
```

### 问题3：前端仍然404

**检查清单**:

1. ✅ 后端是否运行在 `http://localhost:8000`
2. ✅ 能否访问 `http://localhost:8000/video-search/test`
3. ✅ 前端API URL是否正确（检查 `page.tsx` 中的URL）
4. ✅ 浏览器控制台是否有CORS错误

### 问题4：搜索很慢或超时

**原因**: B站搜索 + LLM分析需要时间（5-10秒）

**正常**: 这是预期行为，因为：
1. 搜索B站需要2-3秒
2. 并行分析3个视频需要3-7秒

**如果超过30秒**: 检查网络连接和LLM API

## 📊 完整的启动流程

```
1. 打开终端1 - 启动后端
   cd D:\learnorbit\learnorbit\backend
   python main.py
   → 看到 ✅ 视频搜索功能已启用

2. 打开终端2 - 启动前端（如果没运行）
   cd D:\learnorbit\learnorbit
   npm run dev
   → 前端运行在 http://localhost:3000

3. 打开浏览器
   访问 http://localhost:3000/zh/video-entry
   
4. 测试搜索
   输入: Python基础教程
   点击: 搜索视频
   等待: 5-10秒
   结果: 显示3个视频卡片 + AI分析
```

## ✅ 成功标志

### 后端成功标志

```
✅ 视频搜索功能已启用
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 前端成功标志

1. 页面正常加载，显示标题和搜索框
2. 输入关键词后，按钮变为"搜索中..."
3. 5-10秒后显示3个视频卡片
4. 每个卡片有：
   - 封面图
   - 标题和UP主
   - 学习目标（蓝色框）
   - 适用人群（绿色框）
   - 核心特点（紫色框）
   - 推荐语（黄色框）
   - 开始学习按钮

### 浏览器控制台日志

```
🔍 搜索视频: Python基础教程
✅ 搜索结果: {success: true, videos: Array(3), total: 3, message: "找到 3 个相关视频"}
```

## 🚨 紧急问题处理

如果一切都不工作，尝试重启所有服务：

```bash
# 1. 停止所有进程（Ctrl+C）

# 2. 清理端口
# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# 3. 重新启动
cd D:\learnorbit\learnorbit\backend
python main.py

# 新终端
cd D:\learnorbit\learnorbit
npm run dev
```

## 📞 需要帮助？

如果问题仍然存在，请提供：

1. **后端启动日志**（完整的输出）
2. **浏览器控制台错误**（完整的错误信息）
3. **curl测试结果**
```bash
curl http://localhost:8000/video-search/test
```

---

**现在请启动后端服务，然后刷新前端页面测试！** 🚀

