# B站视频批量解析工具 🎬

一个强大的离线工具，用于批量下载和分析Bilibili视频内容，使用 Gemini AI 进行智能解析。

## ✨ 功能特性

### 1. 批量视频下载
- ✅ 支持单个视频URL或BV号
- ✅ 支持播放列表/系列视频批量下载
- ✅ 自动处理视频格式转换（mp4）
- ✅ 下载完成后自动清理临时文件

### 2. 智能内容分析
- 🤖 使用 Gemini 2.5 Flash 模型进行视频分析
- 📝 预设5种常用分析模板：
  - 生成笔记大纲
  - 提取知识点
  - 生成测验题
  - 生成视频摘要
  - 生成逐字稿
- ✍️ 支持完全自定义 Prompt
- 🔄 支持错误重试和超时处理

### 3. 任务管理
- 📊 实时显示解析进度
- 💾 自动保存结果到本地 JSON 文件
- 📁 历史任务记录查看
- 📥 支持结果导出和下载
- ✅ 成功/失败统计和详细日志

### 4. 用户界面
- 🎨 友好的可视化界面
- 📱 完全响应式设计
- 🔍 可展开查看详细分析结果
- 💬 Markdown 格式渲染分析内容

## 🚀 快速开始

### 1. 安装依赖

#### 后端依赖
```bash
cd backend
pip install -r requirements.txt
```

新增依赖：
- `yt-dlp==2024.12.23` - B站视频下载

#### 前端依赖
前端使用现有依赖，无需额外安装。

### 2. 配置环境变量

确保 `backend/.env` 文件中有 Gemini API Key：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 启动服务

#### 启动后端
```bash
cd backend
python main.py
```

后端将运行在 `http://localhost:8000`

#### 启动前端
```bash
npm run dev
```

前端将运行在 `http://localhost:3000`

### 4. 访问工具

打开浏览器访问：
```
http://localhost:3000/bilibili-batch-analyzer
```

## 📖 使用指南

### 创建新任务

1. **设置任务名称**
   - 输入有意义的任务名称，方便后续查找
   - 例如："Python 入门教程系列"

2. **添加视频链接**
   - 支持完整URL：`https://www.bilibili.com/video/BV1xx411xxx`
   - 支持BV号：`BV1xx411xxx`
   - 点击"添加视频"按钮可添加多个视频

3. **选择或自定义 Prompt**
   - 从5个预设模板中选择
   - 或完全自定义分析提示词
   - Prompt 示例：
     ```
     请分析这个视频的内容，提取：
     1. 核心知识点
     2. 重要概念和定义
     3. 实用技巧和最佳实践
     4. 适合的学习人群
     ```

4. **开始批量解析**
   - 点击"开始批量解析"按钮
   - 实时查看进度和状态
   - 等待任务完成

5. **查看和下载结果**
   - 任务完成后可直接下载JSON文件
   - 或在"历史记录"中查看详细结果

### 查看历史任务

1. 切换到"历史记录"标签
2. 点击任意历史任务查看详情
3. 展开单个视频查看完整分析结果
4. 支持下载原始JSON数据

## 🗂️ 文件结构

### 后端代码

```
backend/
├── app/
│   ├── services/
│   │   ├── bilibili_service.py      # B站视频下载服务
│   │   ├── batch_analyzer.py        # 批量分析服务
│   │   └── gemini_service.py        # Gemini AI 服务
│   ├── api/
│   │   └── routes/
│   │       └── batch_analysis.py    # API 路由
│   └── models/
│       └── video.py                 # 数据模型
├── batch_results/                   # 结果存储目录（自动创建）
│   └── *.json                       # 任务结果文件
└── main.py                          # 主程序入口
```

### 前端代码

```
src/
└── app/
    └── [locale]/
        └── (marketing)/
            └── bilibili-batch-analyzer/
                └── page.tsx         # 批量解析页面
```

## 🔌 API 接口

### 1. 获取 Prompt 模板
```http
GET /batch/templates
```

响应示例：
```json
[
  {
    "id": "outline",
    "name": "生成笔记大纲",
    "description": "为视频内容生成结构化的笔记大纲",
    "prompt": "...",
    "category": "笔记生成"
  }
]
```

### 2. 获取视频信息（不下载）
```http
POST /batch/video-info
Content-Type: application/json

{
  "url": "BV1xx411xxx"
}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "bv_id": "BV1xx411xxx",
    "title": "视频标题",
    "description": "视频描述",
    "duration": 1234,
    "uploader": "UP主昵称",
    "view_count": 10000,
    "thumbnail": "https://..."
  }
}
```

### 3. 创建批量解析任务
```http
POST /batch/jobs
Content-Type: application/json

{
  "video_urls": ["BV1xx411xxx", "BV1yy422yyy"],
  "prompt": "自定义分析提示词",
  "job_name": "任务名称"
}
```

响应示例：
```json
{
  "success": true,
  "job_id": "uuid-string",
  "message": "Job created and started"
}
```

### 4. 查询任务状态
```http
GET /batch/jobs/{job_id}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "job_id": "uuid-string",
    "status": "running",
    "total_videos": 5,
    "completed_videos": 2,
    "failed_videos": 0,
    "progress": 40.0,
    "results": [...],
    "errors": [...]
  }
}
```

### 5. 获取历史任务列表
```http
GET /batch/jobs
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "filename": "Python_Tutorial_20240105_123456.json",
      "job_name": "Python Tutorial",
      "created_at": "2024-01-05T12:34:56",
      "total_videos": 10,
      "completed_videos": 10,
      "failed_videos": 0
    }
  ]
}
```

### 6. 获取任务详细结果
```http
GET /batch/results/{filename}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "job_name": "Python Tutorial",
    "results": [
      {
        "success": true,
        "video_info": {...},
        "analysis": {
          "text": "分析结果内容..."
        }
      }
    ]
  }
}
```

## 💡 使用技巧

### 1. Prompt 优化建议

**好的 Prompt 特征：**
- ✅ 明确具体的分析目标
- ✅ 结构化的输出要求
- ✅ 指定输出格式（Markdown/JSON）
- ✅ 包含具体的分析维度

**示例：**
```markdown
请分析这个编程教程视频，按以下结构输出：

## 📚 知识点清单
- 列出所有重要概念和术语

## 💻 代码片段
- 提取关键代码示例（使用 ```language 代码块）

## 🎯 学习目标
- 这个视频适合什么水平的学习者
- 学习完成后应该掌握什么技能

## ⚠️ 常见错误
- 指出视频中提到的常见陷阱

## 🔗 相关资源
- 建议的后续学习方向
```

### 2. 批量处理策略

**推荐做法：**
- 每批处理 5-10 个视频
- 视频总时长不超过 2 小时
- 使用有意义的任务名称
- 定期下载和备份结果

**注意事项：**
- 视频文件大小限制：100MB
- 单个视频分析超时：10分钟
- Gemini API 有速率限制

### 3. 结果管理

**存储位置：**
- 默认路径：`backend/batch_results/`
- 文件名格式：`{job_name}_{timestamp}.json`

**结果导出：**
- 支持下载 JSON 格式
- 可用于后续处理和分析
- 建议定期清理旧文件

## 🐛 常见问题

### 1. 视频下载失败

**问题：** `Failed to download video`

**可能原因：**
- 视频链接无效或已删除
- 网络连接问题
- B站区域限制

**解决方案：**
- 检查视频链接是否可访问
- 确保网络连接稳定
- 使用 VPN（如果有区域限制）

### 2. Gemini API 错误

**问题：** `503 Service Unavailable`

**可能原因：**
- API 配额用完
- API Key 无效
- Gemini 服务暂时不可用

**解决方案：**
- 检查 API Key 是否正确
- 等待一段时间后重试
- 检查 Google Cloud 控制台配额

### 3. 分析结果为空

**问题：** 任务完成但结果是空的

**可能原因：**
- Prompt 不够明确
- 视频内容不适合分析（如纯音乐）
- 视频时长过长导致超时

**解决方案：**
- 优化 Prompt 使其更具体
- 选择合适的视频内容
- 将长视频分段处理

### 4. 前端无法连接后端

**问题：** API 调用失败

**检查清单：**
- ✅ 后端是否已启动（http://localhost:8000）
- ✅ 后端日志是否有错误
- ✅ 浏览器控制台是否有 CORS 错误
- ✅ 防火墙是否拦截了请求

## 🔒 安全注意事项

1. **API Key 保护**
   - 不要提交 `.env` 文件到 Git
   - 不要在前端代码中硬编码 API Key
   - 定期轮换 API Key

2. **文件存储**
   - 定期清理临时视频文件
   - 注意磁盘空间使用
   - 敏感内容分析结果要妥善保管

3. **速率限制**
   - 遵守 Gemini API 使用条款
   - 避免短时间内大量请求
   - 合理设置并发数量

## 📊 性能优化

### 推荐配置

```python
# backend/app/services/batch_analyzer.py

# 建议的并发设置
MAX_CONCURRENT_DOWNLOADS = 2  # 同时下载的视频数
MAX_CONCURRENT_ANALYSIS = 1   # 同时分析的视频数（受 API 限制）

# 超时设置
VIDEO_DOWNLOAD_TIMEOUT = 300   # 5 分钟
VIDEO_ANALYSIS_TIMEOUT = 600   # 10 分钟
```

### 磁盘空间管理

```bash
# 定期清理下载的视频（临时文件）
# 通常在分析完成后自动删除

# 清理旧的分析结果（可选）
cd backend/batch_results
rm *_202401*.json  # 删除 1月的结果
```

## 🎨 自定义扩展

### 添加新的 Prompt 模板

编辑 `backend/app/api/routes/batch_analysis.py`：

```python
PROMPT_TEMPLATES.append(
    PromptTemplate(
        id="your_template_id",
        name="你的模板名称",
        description="模板描述",
        prompt="你的自定义 Prompt...",
        category="你的分类"
    )
)
```

### 修改存储位置

编辑 `backend/main.py`：

```python
# 初始化批量分析器时指定存储目录
batch_analyzer = BatchAnalyzer(storage_dir="/path/to/your/directory")
```

## 📝 更新日志

### v1.0.0 (2024-01-05)
- ✨ 初始版本发布
- ✅ 支持 B站视频下载
- ✅ 集成 Gemini AI 分析
- ✅ 5种预设 Prompt 模板
- ✅ 实时进度显示
- ✅ 历史任务管理
- ✅ JSON 结果导出

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

建议改进方向：
- [ ] 支持更多视频平台（YouTube、抖音等）
- [ ] 添加视频摘要和关键帧提取
- [ ] 支持导出 Markdown/PDF 格式
- [ ] 添加用户认证和多用户支持
- [ ] 集成数据库替代 JSON 存储
- [ ] 支持定时任务和自动化

## 📄 许可证

MIT License

## 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 强大的视频下载工具
- [Google Gemini](https://ai.google.dev/) - AI 分析能力
- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [Next.js](https://nextjs.org/) - React 应用框架


