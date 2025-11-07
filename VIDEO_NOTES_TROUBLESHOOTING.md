# 视频笔记页面故障排除指南

## 🐛 问题：创建任务失败 `{}`

### 症状

```
创建任务失败: {}
```

前端控制台显示空对象，说明后端API没有返回预期的响应。

## 🔍 诊断步骤

### 1. 检查后端服务状态

```bash
# 方法1: 浏览器访问
http://localhost:8000

# 方法2: PowerShell命令
Test-NetConnection -ComputerName localhost -Port 8000
```

**预期结果**：
- ✅ 浏览器显示"Video Analysis API"欢迎页面
- ✅ PowerShell显示 `TcpTestSucceeded : True`

**如果失败**：
```bash
# 进入backend目录
cd D:\learnorbit\learnorbit\backend

# 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 启动后端服务
python main.py
```

### 2. 测试批量分析API

```bash
# 在backend目录下，虚拟环境已激活
python test_batch_jobs_api.py
```

**成功的输出示例**：
```
🔍 测试批量分析API...
📤 请求 URL: http://localhost:8000/batch/jobs
📦 请求数据: {
  "video_urls": ["https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3"],
  "prompt": "提取视频中的知识点",
  "job_name": "测试任务"
}

📡 响应状态: 200 OK
✅ 响应数据:
{
  "success": true,
  "job_id": "abc123...",
  "message": "批量分析任务已创建"
}

🎉 任务创建成功!
```

**失败的情况及解决方案**：

#### 情况1: 连接失败
```
❌ 无法连接到后端服务器
```

**解决方案**：
1. 检查后端服务是否运行
2. 检查端口8000是否被占用
3. 重启后端服务

#### 情况2: 404 Not Found
```
📡 响应状态: 404 Not Found
```

**原因**：批量分析路由未注册

**解决方案**：
检查后端启动日志，应该看到：
```
✅ 批量分析功能已启用
```

如果看到：
```
⚠️ 批量分析路由模块导入失败
```

说明路由导入失败，检查：
```bash
python -m py_compile app/api/routes/batch_analysis.py
```

#### 情况3: 500 Internal Server Error
```
📡 响应状态: 500 Internal Server Error
```

**原因**：后端代码异常

**解决方案**：
查看后端终端的错误日志，通常会显示Python异常堆栈。

#### 情况4: 返回空对象 `{}`
```
📦 响应数据: {}
```

**可能原因**：
1. 后端返回了非JSON响应
2. 请求参数格式错误
3. 后端异常但没有正确处理

**解决方案**：
查看后端日志，寻找错误信息。

### 3. 检查前端网络请求

打开浏览器开发者工具（F12）→ Network标签页：

1. 刷新页面，触发视频解析
2. 找到 `batch/jobs` 请求
3. 查看：
   - **Status**: 应该是 `200 OK`
   - **Request Payload**: 检查发送的数据
   - **Response**: 查看返回的数据

**正常的Request**：
```json
{
  "video_urls": ["https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3"],
  "prompt": "提取视频中的知识点",
  "job_name": "视频笔记测试"
}
```

**正常的Response**：
```json
{
  "success": true,
  "job_id": "dd4cc5f8-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "批量分析任务已创建",
  "job_name": "视频笔记测试",
  "total_videos": 1
}
```

### 4. 检查前端控制台日志

打开浏览器开发者工具（F12）→ Console标签页：

**正常的日志流程**：
```
📤 发送视频解析请求: {video_urls: Array(1), prompt: "提取视频中的知识点", ...}
📡 响应状态: 200 OK
📦 响应数据: {success: true, job_id: "...", ...}
✅ 任务创建成功, Job ID: dd4cc5f8-...
🔄 轮询任务状态: dd4cc5f8-...
📊 任务状态: processing
...
```

**异常的日志**：
```
📤 发送视频解析请求: ...
📡 响应状态: 200 OK
📦 响应数据: {}
❌ 创建任务失败: {}
```

## 🔧 常见问题及解决方案

### 问题1: 后端服务未启动

**症状**：
- 浏览器提示 "Failed to fetch"
- 控制台显示 "net::ERR_CONNECTION_REFUSED"

**解决方案**：
```bash
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

### 问题2: 端口被占用

**症状**：
```
ERROR: [Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000)
```

**解决方案**：
```bash
# 查找占用8000端口的进程
netstat -ano | findstr :8000

# 结束进程（替换PID）
taskkill /PID <PID> /F

# 或者修改端口
# 在 backend/.env 或 main.py 中修改 PORT
```

### 问题3: 虚拟环境未激活

**症状**：
```
ModuleNotFoundError: No module named 'fastapi'
```

**解决方案**：
```bash
# 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 验证（应该显示虚拟环境路径）
python -c "import sys; print(sys.prefix)"

# 如果虚拟环境不存在，重新创建
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 问题4: 依赖未安装

**症状**：
```
ModuleNotFoundError: No module named 'aiohttp'
```

**解决方案**：
```bash
# 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 安装缺失的依赖
pip install -r requirements.txt

# 或单独安装
pip install aiohttp requests fastapi uvicorn
```

### 问题5: 环境变量未配置

**症状**：
后端日志显示：
```
⚠️ BAIJIA_API_KEY not set
⚠️ ASR_APP_KEY not set
```

**解决方案**：
创建或编辑 `backend/.env` 文件：
```env
# LLM API配置
BAIJIA_API_KEY=your_api_key_here
BAIJIA_BASE_URL=https://llm.baijia.com/v1
BAIJIA_MODEL=yi-lightning

# ASR配置
ASR_APP_KEY=your_app_key_here
ASR_ACCESS_TOKEN=your_access_token_here
ASR_API_URL=https://openspeech.bytedance.com/api/v1/uc
```

### 问题6: 视频URL格式错误

**症状**：
任务创建成功，但分析失败：
```
Failed to download video: [ERROR] Invalid URL
```

**解决方案**：
确保视频URL格式正确：
```
✅ https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3
✅ https://www.bilibili.com/video/BV1Jgf6YvE8e
❌ www.bilibili.com/video/BV1Jgf6YvE8e (缺少协议)
❌ BV1Jgf6YvE8e (只有ID)
```

### 问题7: CORS错误

**症状**：
浏览器控制台显示：
```
Access to fetch at 'http://localhost:8000/batch/jobs' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**解决方案**：
检查后端 `main.py` 中的CORS配置：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # 确保包含前端URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🧪 快速自检清单

运行以下命令进行快速自检：

```bash
# 1. 检查后端服务
curl http://localhost:8000

# 2. 检查批量分析API
cd backend
python test_batch_jobs_api.py

# 3. 检查Python环境
python -c "import fastapi, aiohttp, requests; print('✅ 依赖正常')"

# 4. 检查端口占用
netstat -ano | findstr :8000

# 5. 查看后端日志
# 在运行 python main.py 的终端中查看
```

## 📊 调试信息收集

如果问题仍未解决，收集以下信息：

### 1. 前端信息
- 浏览器控制台完整日志（Console标签）
- 网络请求详情（Network标签 → batch/jobs请求）
- 前端版本：查看 `package.json`

### 2. 后端信息
- 后端启动日志（python main.py输出）
- 后端版本：`python --version`
- 依赖版本：`pip list | findstr fastapi`
- 环境变量：`echo $env:BAIJIA_API_KEY`（PowerShell）

### 3. 系统信息
- 操作系统：`systeminfo | findstr /B /C:"OS Name" /C:"OS Version"`
- Python版本：`python --version`
- Node版本：`node --version`

## 💡 最佳实践

### 开发环境启动顺序

1. **启动后端**（先启动）
   ```bash
   cd backend
   .\venv\Scripts\Activate.ps1
   python main.py
   ```
   等待看到：
   ```
   ✅ 视频分析功能已启用
   ✅ 批量分析功能已启用
   ✅ 笔记生成功能已启用
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **启动前端**（后启动）
   ```bash
   # 新终端
   cd D:\learnorbit\learnorbit
   npm run dev
   ```
   等待看到：
   ```
   - Local: http://localhost:3000
   ✓ Ready in 2.3s
   ```

3. **访问页面**
   ```
   http://localhost:3000/zh/video-notes-prototype
   ```

### 日常维护

#### 清理缓存
```bash
# 清理ASR缓存
rm backend/cache/asr_*.json

# 清理笔记缓存
rm backend/cache/notes/*.json

# 清理视频分析缓存
rm backend/cache/*.json -Exclude cache_index.json
```

#### 重置环境
```bash
# 后端
cd backend
deactivate  # 如果虚拟环境已激活
rm -r venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 前端
cd ..
rm -r node_modules
rm package-lock.json
npm install
```

## 📞 获取帮助

如果上述步骤都无法解决问题：

1. **查看日志**：
   - 后端：`backend/logs/` 目录（如果有）
   - 前端：浏览器控制台

2. **搜索错误信息**：
   - 复制完整的错误消息
   - 在GitHub Issues或Stack Overflow搜索

3. **提供信息**：
   - 完整的错误日志
   - 复现步骤
   - 系统环境信息

## 🎯 总结

大多数"创建任务失败: {}"问题都是由以下原因引起的：

1. ❌ **后端服务未运行** - 最常见
2. ❌ **虚拟环境未激活**
3. ❌ **依赖未安装**
4. ❌ **环境变量未配置**
5. ❌ **端口被占用**

**解决方案模板**：
```bash
# 1. 进入后端目录
cd D:\learnorbit\learnorbit\backend

# 2. 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 3. 确保依赖已安装
pip install -r requirements.txt

# 4. 启动后端服务
python main.py

# 5. 在浏览器测试
# 打开 http://localhost:8000
# 应该看到欢迎页面

# 6. 刷新前端页面
# http://localhost:3000/zh/video-notes-prototype
```

---

**🎉 按照上述步骤，应该可以解决大部分问题！如果仍有问题，请查看后端终端的详细错误信息。**

