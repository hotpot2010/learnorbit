# Backend 本地开发说明

## 📍 重要说明

`backend/` 文件夹仅用于本地开发和调试，**不会推送到远程Git仓库**。

## 🚀 本地开发设置

### 1. 进入backend目录
```bash
cd backend
```

### 2. 设置Python虚拟环境
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac  
python3 -m venv venv
source venv/bin/activate
```

### 3. 安装依赖
```bash
pip install -r requirements.txt
```

### 4. 配置环境变量
```bash
# 复制环境变量模板
copy env.example .env

# 编辑 .env 文件，添加必要的配置：
# GEMINI_API_KEY=your_gemini_api_key_here
# SECRET_KEY=your_secret_key_here
```

### 5. 启动开发服务器
```bash
# 使用启动脚本（推荐）
python start.py

# 或直接使用uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 🔧 开发工具

### API文档
- Swagger UI: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc

### 测试脚本
```bash
python test_api.py
```

### 健康检查
```bash
curl http://localhost:8000/health
```

## 📁 目录结构
```
backend/                    # 本地开发目录（不推送到Git）
├── app/
│   ├── api/routes/         # API路由
│   ├── core/              # 核心配置
│   ├── models/            # 数据模型
│   ├── services/          # 业务服务
│   └── utils/             # 工具函数
├── uploads/               # 上传文件目录（自动创建）
├── .env                   # 环境变量（不推送）
├── main.py                # 应用入口
├── start.py               # 启动脚本
├── requirements.txt       # Python依赖
├── README.md              # 详细文档
└── INSTALL.md             # 安装指南
```

## 🎯 主要功能

### 视频分析API
- **上传分析**: `POST /api/v1/video/upload-and-analyze`
- **路径分析**: `POST /api/v1/video/analyze-by-path`  
- **分析类型**: `GET /api/v1/video/analysis-types`

### 支持的分析类型
1. **通用分析** (`general`) - 全面内容分析
2. **教育分析** (`educational`) - 教学价值评估
3. **内容摘要** (`summary`) - 核心要点提取
4. **测试生成** (`quiz`) - 基于内容生成题目

### 支持的视频格式
- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- MKV (.mkv)
- WebM (.webm)

## 🔐 安全注意事项

1. **API密钥保护**: 
   - `.env` 文件已在 `.gitignore` 中，不会被提交
   - 不要在代码中硬编码API密钥

2. **文件上传限制**:
   - 最大文件大小: 100MB（可配置）
   - 自动文件类型验证
   - 临时文件自动清理

## 🐛 故障排除

### 常见问题
1. **端口占用**: 修改启动脚本中的端口号
2. **依赖缺失**: 重新运行 `pip install -r requirements.txt`
3. **API密钥错误**: 检查 `.env` 文件配置
4. **文件权限**: 确保有写入 `uploads/` 目录的权限

### 日志查看
启动服务后会显示详细日志，包括：
- HTTP请求响应
- 文件处理状态  
- Gemini API调用
- 错误堆栈信息

## 📝 开发注意事项

1. **本地调试专用**: 此backend仅用于本地开发和测试
2. **不推送远程**: 已在 `.gitignore` 中排除，避免意外提交
3. **环境隔离**: 使用虚拟环境避免依赖冲突
4. **定期清理**: 注意清理 `uploads/` 目录中的临时文件

## 🚀 后续集成

当需要集成到前端时：
1. 确保CORS配置正确
2. 前端调用API的URL指向 `http://localhost:8000`
3. 处理文件上传的进度显示
4. 实现错误处理和用户反馈

---

**注意**: 这是一个本地开发环境，生产部署时需要考虑安全性、性能优化和部署架构。
