# B站视频批量解析工具 - 安装指南 📦

一步一步安装和配置 Bilibili Batch Analyzer。

## 🎯 前置要求

- Python 3.8+ （推荐 3.10 或 3.11）
- Node.js 18+ （用于前端）
- 稳定的网络连接
- Google Gemini API Key

## 📝 安装步骤

### 步骤 1：安装 Python 依赖

```bash
# 进入后端目录
cd backend

# 安装新依赖
pip install yt-dlp==2024.12.23

# 或者重新安装所有依赖
pip install -r requirements.txt
```

**验证安装：**
```bash
python -c "import yt_dlp; print('✅ yt-dlp installed:', yt_dlp.version.__version__)"
```

### 步骤 2：配置环境变量

编辑 `backend/.env` 文件，确保包含：

```env
# Gemini API Key（必需）
GEMINI_API_KEY=your_actual_api_key_here

# 可选配置
HOST=0.0.0.0
PORT=8000
DEBUG=True
CORS_ORIGINS=["http://localhost:3000", "http://127.0.0.1:3000"]
```

**获取 Gemini API Key：**
1. 访问 https://ai.google.dev/
2. 注册/登录 Google 账号
3. 创建 API Key
4. 复制并粘贴到 `.env` 文件

### 步骤 3：创建必要的目录

```bash
# 在 backend 目录下
mkdir -p batch_results
```

### 步骤 4：运行测试脚本

```bash
cd backend
python test_bilibili_batch.py
```

**期望输出：**
```
🎬 Bilibili Batch Analyzer - Setup Test
============================================================
🔍 Testing package imports...
✅ FastAPI installed
✅ Google Generative AI installed
✅ yt-dlp installed
✅ All required packages are installed!

🔍 Testing environment configuration...
✅ GEMINI_API_KEY configured (length: 39)

🔍 Testing service initialization...
✅ BilibiliService initialized
✅ GeminiService initialized
✅ BatchAnalyzer initialized
✅ All services initialized successfully!

🔍 Testing storage directory...
✅ Storage directory 'batch_results' is ready

🔍 Testing video info extraction...
✅ Video info extracted successfully!
   Title: ...
   Duration: ... seconds
   Uploader: ...

============================================================
📊 Test Summary
============================================================
✅ PASSED: Package Imports
✅ PASSED: Environment Config
✅ PASSED: Service Initialization
✅ PASSED: Storage Directory
✅ PASSED: Video Info Extraction
============================================================

🎉 All tests passed! Your setup is ready to use!

💡 Next steps:
   1. Start the backend: python main.py
   2. Start the frontend: npm run dev
   3. Visit: http://localhost:3000/bilibili-batch-analyzer
```

### 步骤 5：启动后端服务

```bash
cd backend
python main.py
```

**成功标志：**
```
✅ 视频分析功能已启用
✅ 批量分析功能已启用
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 步骤 6：验证后端 API

在浏览器中访问：
```
http://localhost:8000/docs
```

你应该看到 FastAPI 的 Swagger UI 文档，包含新的 `/batch` 端点。

### 步骤 7：启动前端（如果还没启动）

```bash
# 在项目根目录
npm run dev
```

### 步骤 8：访问应用

打开浏览器访问：
```
http://localhost:3000/bilibili-batch-analyzer
```

## ✅ 验证安装

### 快速测试

1. **测试视频信息提取**（不下载）：
   ```bash
   cd backend
   python example_usage.py
   # 选择选项 1
   ```

2. **测试完整流程**（包含下载和分析）：
   - 访问 Web 界面
   - 输入任务名称："测试任务"
   - 添加一个短视频的 BV 号
   - 选择"生成视频摘要"模板
   - 点击"开始批量解析"
   - 等待完成

## 🐛 常见问题解决

### 问题 1：yt-dlp 安装失败

**症状：**
```
ERROR: Could not find a version that satisfies the requirement yt-dlp
```

**解决方案：**
```bash
# 更新 pip
pip install --upgrade pip

# 重试安装
pip install yt-dlp

# 如果还是失败，尝试指定镜像源
pip install yt-dlp -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 问题 2：Gemini API Key 无效

**症状：**
```
❌ GEMINI_API_KEY looks like a placeholder
```

**解决方案：**
1. 确认已从 https://ai.google.dev/ 获取真实 API Key
2. 检查 `.env` 文件中的 Key 是否正确（无多余空格）
3. 确保 Key 没有过期或被撤销

### 问题 3：后端启动后无法访问

**症状：**
- 浏览器显示"无法连接"
- 前端 API 调用失败

**解决方案：**
```bash
# 1. 检查后端是否真的在运行
# Windows:
netstat -ano | findstr :8000

# Mac/Linux:
lsof -i :8000

# 2. 检查防火墙设置
# 允许 8000 端口访问

# 3. 尝试直接访问
curl http://localhost:8000/
```

### 问题 4：视频下载失败

**症状：**
```
Failed to download video: ...
```

**可能原因和解决方案：**

1. **网络问题**
   ```bash
   # 测试网络连接
   ping bilibili.com
   ```

2. **视频不存在或已删除**
   - 在浏览器中手动访问视频链接
   - 确认视频可以正常播放

3. **地区限制**
   - 使用 VPN（如果在限制地区）
   - 尝试其他视频

4. **yt-dlp 版本过旧**
   ```bash
   pip install --upgrade yt-dlp
   ```

### 问题 5：分析超时

**症状：**
```
TimeoutError: Video analysis exceeded 10 minutes
```

**解决方案：**
1. 选择较短的视频（< 20 分钟）
2. 检查网络连接稳定性
3. 减少同时处理的视频数量

### 问题 6：前端无法连接后端

**症状：**
- 网络错误
- CORS 错误

**解决方案：**

1. **检查后端是否启动**
   ```bash
   curl http://localhost:8000/
   ```

2. **检查 CORS 配置**
   - 编辑 `backend/.env`
   - 确保 CORS_ORIGINS 包含前端地址
   ```env
   CORS_ORIGINS=["http://localhost:3000"]
   ```

3. **清除浏览器缓存**
   - 按 Ctrl+Shift+Delete
   - 清除缓存和 Cookie

## 📚 下一步

安装成功后，建议：

1. **阅读快速上手指南**
   ```
   BILIBILI_BATCH_ANALYZER_QUICKSTART.md
   ```

2. **查看完整文档**
   ```
   BILIBILI_BATCH_ANALYZER.md
   ```

3. **尝试示例代码**
   ```bash
   cd backend
   python example_usage.py
   ```

4. **自定义 Prompt**
   - 研究预设模板
   - 根据需求定制分析提示词

## 🔧 高级配置

### 修改超时设置

编辑 `backend/app/services/gemini_service.py`：

```python
# 视频处理超时（秒）
VIDEO_PROCESSING_TIMEOUT = 300  # 默认 5 分钟

# AI 生成超时（秒）
CONTENT_GENERATION_TIMEOUT = 120  # 默认 2 分钟
```

### 修改文件大小限制

编辑 `backend/app/services/gemini_service.py`：

```python
# 最大文件大小（字节）
MAX_FILE_SIZE = 100 * 1024 * 1024  # 默认 100MB
```

### 更改存储目录

编辑 `backend/app/api/routes/batch_analysis.py`：

```python
# 初始化批量分析器
batch_analyzer = BatchAnalyzer(storage_dir="your_custom_dir")
```

### 添加自定义 Prompt 模板

编辑 `backend/app/api/routes/batch_analysis.py`，在 `PROMPT_TEMPLATES` 列表中添加：

```python
PROMPT_TEMPLATES.append(
    PromptTemplate(
        id="custom_template",
        name="我的自定义模板",
        description="模板描述",
        prompt="你的自定义 Prompt 内容...",
        category="自定义"
    )
)
```

## 🎓 学习资源

- **yt-dlp 文档**: https://github.com/yt-dlp/yt-dlp
- **Gemini API 文档**: https://ai.google.dev/docs
- **FastAPI 文档**: https://fastapi.tiangolo.com/
- **项目 API 文档**: http://localhost:8000/docs

## 🆘 获取帮助

如果遇到问题：

1. **查看测试脚本输出**
   ```bash
   python test_bilibili_batch.py
   ```

2. **查看后端日志**
   - 启动后端时观察控制台输出
   - 查找错误信息和堆栈跟踪

3. **查看浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Network 和 Console 标签

4. **查看 API 文档**
   - http://localhost:8000/docs
   - 测试单个 API 端点

## ✅ 安装完成清单

- [ ] Python 依赖已安装（包括 yt-dlp）
- [ ] `.env` 文件已配置（GEMINI_API_KEY）
- [ ] 测试脚本运行成功
- [ ] 后端服务启动成功（端口 8000）
- [ ] 前端服务启动成功（端口 3000）
- [ ] 可以访问 Web 界面
- [ ] 可以访问 API 文档
- [ ] 已测试基本功能（视频信息提取）

## 🎉 开始使用

恭喜！你已经成功安装了 B站视频批量解析工具！

现在你可以：
- 批量分析 B站视频内容
- 生成学习笔记和知识点
- 创建测验题目
- 导出分析结果

开始你的第一个批量分析任务吧！🚀


