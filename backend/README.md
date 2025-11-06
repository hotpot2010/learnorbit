# Video Analysis API Backend

基于FastAPI和Gemini AI的视频内容分析服务

## 🎯 功能特性

- **视频上传分析**: 支持多种视频格式的上传和AI分析
- **路径分析**: 通过文件路径直接分析本地视频
- **多种分析类型**: 通用分析、教育分析、内容摘要、测试生成
- **Gemini AI集成**: 使用Google Gemini AI进行智能内容分析
- **RESTful API**: 完整的REST API接口
- **自动文档**: Swagger UI和ReDoc自动API文档

## 🚀 快速开始

### 1. 一键安装（推荐）

```bash
cd backend
python one_click_setup.py
```

### 2. 手动安装

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
copy env.example .env
# 编辑.env文件，添加您的GEMINI_API_KEY
```

### 3. 启动服务

```bash
# 完整版本（需要Gemini API密钥）
python main.py

# 简化版本（测试用）
python main_simple.py

# 或使用启动脚本
python start.py
```

## 📡 API端点

### 基础信息
- `GET /` - 根端点信息
- `GET /docs` - Swagger UI文档
- `GET /redoc` - ReDoc文档

### 健康检查
- `GET /api/v1/video/health` - 服务健康状态

### 分析类型
- `GET /api/v1/video/analysis-types` - 获取可用分析类型

### 视频分析
- `POST /api/v1/video/upload-and-analyze` - 上传并分析视频
- `POST /api/v1/video/analyze-by-path` - 通过路径分析视频

## 📋 分析类型说明

| 类型 | 值 | 描述 |
|------|----|----|
| 通用分析 | `general` | 全面分析视频内容，包括主题、结构、质量等 |
| 教育分析 | `educational` | 从教育角度分析，评估教学价值和学习成果 |
| 内容摘要 | `summary` | 提取核心要点，生成结构化摘要 |
| 测试生成 | `quiz` | 基于视频内容生成测试题目和答案 |

## 🎬 支持的视频格式

- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- MKV (.mkv)
- WebM (.webm)
- FLV (.flv)
- WMV (.wmv)
- M4V (.m4v)
- 3GP (.3gp)
- OGV (.ogv)

## 🔧 配置说明

### 环境变量

```bash
# 必需配置
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here

# 可选配置
HOST=0.0.0.0
PORT=8000
DEBUG=true
MAX_UPLOAD_SIZE=104857600  # 100MB
UPLOAD_DIR=uploads
CORS_ORIGINS=["http://localhost:3000"]
```

### 获取Gemini API密钥

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建新的API密钥
3. 将密钥添加到`.env`文件中的`GEMINI_API_KEY`

## 🧪 测试

### 环境测试
```bash
python test_setup.py
```

### API测试
```bash
python test_api.py
```

### 手动测试
```bash
# 健康检查
curl http://localhost:8000/api/v1/video/health

# 获取分析类型
curl http://localhost:8000/api/v1/video/analysis-types
```

## 📁 项目结构

```
backend/
├── app/
│   ├── api/routes/         # API路由
│   ├── core/              # 核心配置
│   ├── models/            # 数据模型
│   ├── services/          # 业务服务
│   └── utils/             # 工具函数
├── uploads/               # 上传文件目录
├── venv/                  # 虚拟环境
├── main.py                # 主应用入口
├── main_simple.py         # 简化版应用
├── requirements.txt       # 依赖列表
├── env.example           # 环境变量模板
├── start.py              # 启动脚本
├── test_api.py           # API测试
├── test_setup.py         # 环境测试
└── one_click_setup.py    # 一键安装脚本
```

## 🔒 安全注意事项

1. **API密钥保护**: 不要将API密钥提交到版本控制系统
2. **文件上传限制**: 默认限制100MB，可通过环境变量调整
3. **CORS配置**: 根据需要配置允许的源域名
4. **临时文件清理**: 系统自动清理上传的临时文件

## 🐛 故障排除

### 常见问题

1. **Rust编译错误**
   ```bash
   # 使用一键设置
   python one_click_setup.py
   
   # 或使用简化版本
   python main_simple.py
   ```

2. **Pillow安装失败**
   ```bash
   pip install --only-binary=Pillow Pillow
   ```

3. **依赖冲突**
   ```bash
   pip install --upgrade pip setuptools wheel
   pip cache purge
   pip install -r requirements.txt --force-reinstall
   ```

4. **Gemini API错误**
   - 检查API密钥是否正确
   - 确认API配额未超限
   - 验证网络连接

### 日志查看

启动服务后查看控制台输出，包括：
- HTTP请求日志
- 文件处理状态
- Gemini API调用
- 错误信息

## 📈 性能优化

1. **文件大小**: 建议视频文件不超过100MB
2. **并发限制**: 根据服务器性能调整并发数
3. **缓存策略**: 考虑添加分析结果缓存
4. **异步处理**: 对于大文件可考虑异步处理

## 🔄 开发模式

```bash
# 开发模式启动（自动重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📞 技术支持

如遇到问题，请检查：
1. Python版本（需要3.8+）
2. 虚拟环境是否激活
3. 依赖是否正确安装
4. 环境变量是否配置
5. API密钥是否有效

---

**注意**: 此backend仅用于本地开发，不会推送到远程Git仓库。
