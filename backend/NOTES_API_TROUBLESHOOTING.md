# 笔记API故障排除指南

## 问题：笔记生成失败 "Failed to generate note: undefined"

### 可能原因

1. **后端服务器未运行**
2. **笔记路由未正确注册**
3. **端口冲突或URL错误**
4. **LLM API调用失败**

## 诊断步骤

### 1. 检查后端服务器是否运行

```bash
# 进入后端目录
cd backend

# 检查服务器状态
python check_notes_endpoint.py
```

如果显示 "Server is not running"，需要启动服务器：

```bash
# Windows (PowerShell)
.\.venv\Scripts\activate
python main.py

# Linux/Mac
source .venv/bin/activate
python main.py
```

### 2. 查看服务器启动日志

启动服务器时应该看到：

```
🚀 Starting Video Analysis API Server...
✅ 视频分析功能已启用
✅ 批量分析功能已启用
✅ 笔记生成功能已启用  ← 确认这一行存在
📍 Server will run on: http://0.0.0.0:8000
```

如果没有 "✅ 笔记生成功能已启用"，说明路由导入失败。

### 3. 测试笔记API端点

#### 方法1: 使用测试脚本

```bash
# 在backend目录
python test_notes_api.py
```

#### 方法2: 使用curl

```bash
curl -X POST http://localhost:8000/notes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_point_name": "测试知识点",
    "transcript_segment": "这是测试内容",
    "video_title": "测试视频"
  }'
```

#### 方法3: 浏览器访问API文档

打开 http://localhost:8000/docs

查找 `/notes/generate` 端点，点击 "Try it out" 测试。

### 4. 检查环境变量

确保 `.env` 文件包含 Baijia API 密钥：

```env
BAIJIA_API_KEY=sk-7BfuPhPxtPMjaAJn86vR2g
BAIJIA_BASE_URL=https://llm.baijia.com/v1/chat/completions
BAIJIA_MODEL=claude-4.5-sonnet
```

### 5. 查看详细错误日志

#### 前端控制台（浏览器）

打开开发者工具 (F12)，查看 Console 标签：

```
🔗 Calling backend API: http://localhost:8000/notes/generate
📡 Response status: 200 OK
📦 Response data: { success: false, error: "具体错误信息" }
```

#### 后端控制台（终端）

服务器运行窗口应该显示：

```
📝 Generating note for knowledge point: 访问Python官网下载
📄 Transcript segment length: 156 chars
🤖 Generating outline with Baijia LLM...
✅ Note generated successfully
```

如果出现错误，会显示详细的堆栈跟踪。

## 常见问题和解决方案

### 问题1: 404 Not Found

**症状**:
```
📡 Response status: 404 Not Found
```

**原因**: 笔记路由未正确注册

**解决方案**:
1. 检查 `backend/main.py` 中是否包含：
   ```python
   app.include_router(notes.router, prefix="/notes", tags=["notes"])
   ```

2. 重启后端服务器

### 问题2: 500 Internal Server Error

**症状**:
```
📡 Response status: 500 Internal Server Error
```

**原因**: LLM API调用失败或代码错误

**解决方案**:
1. 查看后端控制台的详细错误信息
2. 检查 `BAIJIA_API_KEY` 是否正确
3. 测试 LLM API 连接：
   ```bash
   cd backend
   python -c "from app.services.doubao_service import DoubaoService; import asyncio; s = DoubaoService(); print(asyncio.run(s.generate_outline('测试', '生成一句话')))"
   ```

### 问题3: CORS错误

**症状**:
```
Access to fetch at 'http://localhost:8000/notes/generate' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**原因**: 前端域名未在CORS白名单

**解决方案**:
1. 检查 `backend/main.py` 的 CORS 配置：
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

2. 重启后端服务器

### 问题4: 连接超时

**症状**:
```
❌ Error generating note: TypeError: Failed to fetch
```

**原因**: 后端服务器未运行或端口错误

**解决方案**:
1. 确认后端运行在 http://localhost:8000
2. 如果使用其他端口，修改前端URL
3. 检查防火墙设置

### 问题5: 逐字稿片段为空

**症状**:
```
📄 Transcript segment: 
⚠️ Empty transcript segment
```

**原因**: 时间戳匹配失败或逐字稿格式不正确

**解决方案**:
1. 检查 `fullTranscript` 是否包含数据
2. 确认逐字稿格式: `[MM:SS - MM:SS] 文本`
3. 在浏览器控制台运行：
   ```javascript
   console.log('Full transcript:', fullTranscript.substring(0, 200));
   ```

### 问题6: LLM响应格式错误

**症状**:
```
❌ Error extracting content: KeyError 'choices'
```

**原因**: LLM API返回格式不符合预期

**解决方案**:
1. 查看后端控制台的完整响应
2. 检查 `BAIJIA_MODEL` 是否正确
3. 测试API连接（见问题2的解决方案）

## 手动测试流程

### 1. 确认后端运行

```bash
curl http://localhost:8000/
```

应该返回HTML欢迎页面。

### 2. 测试笔记API

```bash
curl -X POST http://localhost:8000/notes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_point_name": "Python安装",
    "transcript_segment": "[00:00 - 00:10] 首先访问Python官网。[00:10 - 00:20] 选择适合你操作系统的版本。",
    "video_title": "Python教程"
  }'
```

期望响应：
```json
{
  "success": true,
  "note": "## Python安装\n\n1. 访问官网\n2. 选择系统版本\n...",
  "error": null
}
```

### 3. 检查前端调用

在浏览器控制台（F12）运行：

```javascript
fetch('http://localhost:8000/notes/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    knowledge_point_name: '测试',
    transcript_segment: '测试内容',
    video_title: '测试'
  })
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e));
```

## 重启服务的正确步骤

### 后端服务器

```bash
# 1. 停止现有服务器 (Ctrl+C)

# 2. 激活虚拟环境
cd backend
.\.venv\Scripts\activate  # Windows
# 或
source .venv/bin/activate  # Linux/Mac

# 3. 重启服务器
python main.py

# 4. 等待看到以下日志：
# ✅ 笔记生成功能已启用
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 前端开发服务器

```bash
# 1. 停止现有服务器 (Ctrl+C)

# 2. 重启
npm run dev
# 或
pnpm dev

# 3. 访问 http://localhost:3000/zh/video-notes-prototype
```

## 获取更多帮助

如果问题仍未解决：

1. **查看完整日志**：
   - 前端：浏览器控制台 (F12 → Console)
   - 后端：服务器运行窗口

2. **运行诊断脚本**：
   ```bash
   cd backend
   python check_notes_endpoint.py
   ```

3. **查看API文档**：
   http://localhost:8000/docs

4. **检查文件**：
   - `backend/app/api/routes/notes.py` - 路由定义
   - `backend/main.py` - 路由注册
   - `backend/app/services/doubao_service.py` - LLM服务

5. **提供以下信息**：
   - 前端控制台的完整错误信息
   - 后端控制台的日志
   - 诊断脚本的输出结果

## 成功运行的标志

### 后端启动成功

```
✅ 视频分析功能已启用
✅ 批量分析功能已启用
✅ 笔记生成功能已启用
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 笔记生成成功

**前端控制台**：
```
📝 Generating note for: 访问Python官网下载
📄 Transcript segment: [00:23 - 00:35] ...
🔗 Calling backend API: http://localhost:8000/notes/generate
📡 Response status: 200 OK
📦 Response data: {success: true, note: "..."}
✅ Note generated successfully
```

**后端控制台**：
```
📝 Generating note for knowledge point: 访问Python官网下载
📄 Transcript segment length: 156 chars
🤖 Generating outline with Baijia LLM...
📡 Response status: 200 (attempt 1/3)
✅ API response received
✅ Outline generated (245 chars)
✅ Note generated successfully
```

**UI显示**：
- 知识点卡片展开
- 显示笔记内容（Markdown格式）
- 可能显示视频截图（如果CORS支持）
- 悬停时显示编辑按钮

