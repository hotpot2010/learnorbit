# Bilibili Batch Analyzer API 🎬

批量下载和分析 Bilibili 视频的后端服务。

## 🚀 快速测试

运行测试脚本验证安装：
```bash
python test_bilibili_batch.py
```

## 📁 项目结构

```
backend/
├── app/
│   ├── services/
│   │   ├── bilibili_service.py       # B站视频下载
│   │   ├── batch_analyzer.py         # 批量分析管理
│   │   └── gemini_service.py         # AI 分析
│   └── api/
│       └── routes/
│           └── batch_analysis.py     # API 端点
├── batch_results/                    # 结果存储（JSON）
├── test_bilibili_batch.py           # 测试脚本
└── main.py                          # 服务入口
```

## 🔧 核心服务

### BilibiliService

负责视频下载和信息提取：

```python
from app.services.bilibili_service import BilibiliService

service = BilibiliService()

# 获取视频信息（不下载）
info = service.extract_video_info("BV1xx411xxx")
print(info['title'], info['duration'])

# 下载视频
result = service.download_video("BV1xx411xxx")
print(result['file_path'])

# 清理临时文件
service.cleanup_video(result['file_path'])
```

### BatchAnalyzer

管理批量分析任务：

```python
from app.services.batch_analyzer import BatchAnalyzer

analyzer = BatchAnalyzer(storage_dir="batch_results")

# 创建任务
job_id = analyzer.create_job(
    video_urls=["BV1xx411xxx", "BV1yy422yyy"],
    prompt="请生成笔记大纲",
    job_name="Python教程分析"
)

# 运行任务
def on_progress(job):
    print(f"进度: {job['completed_videos']}/{job['total_videos']}")

result = analyzer.run_job(job_id, progress_callback=on_progress)

# 查看结果
print(f"成功: {result['completed_videos']}")
print(f"失败: {result['failed_videos']}")
```

### GeminiService

AI 视频分析：

```python
from app.services.gemini_service import GeminiService
from app.models.video import AnalysisType

service = GeminiService()

# 分析视频
result = service.analyze_video(
    video_path="video.mp4",
    analysis_type=AnalysisType.CUSTOM,
    custom_prompt="提取关键知识点"
)

print(result['text'])
```

## 🌐 API 端点

### 获取 Prompt 模板
```http
GET /batch/templates

Response:
[
  {
    "id": "outline",
    "name": "生成笔记大纲",
    "prompt": "...",
    "category": "笔记生成"
  }
]
```

### 创建任务
```http
POST /batch/jobs
Content-Type: application/json

{
  "video_urls": ["BV1xx411xxx"],
  "prompt": "分析提示词",
  "job_name": "任务名称"
}

Response:
{
  "success": true,
  "job_id": "uuid",
  "message": "Job created and started"
}
```

### 查询任务状态
```http
GET /batch/jobs/{job_id}

Response:
{
  "success": true,
  "data": {
    "status": "running",
    "progress": 40.0,
    "completed_videos": 2,
    "total_videos": 5
  }
}
```

### 获取历史任务
```http
GET /batch/jobs

Response:
{
  "success": true,
  "data": [
    {
      "filename": "job_20240105.json",
      "job_name": "Python教程",
      "total_videos": 5
    }
  ]
}
```

### 获取任务结果
```http
GET /batch/results/{filename}

Response:
{
  "success": true,
  "data": {
    "results": [...],
    "errors": [...]
  }
}
```

## 🎯 Prompt 模板

内置 5 种模板：

1. **生成笔记大纲** - 结构化笔记
2. **提取知识点** - 概念和定义
3. **生成测验题** - 选择题/判断题/简答题
4. **生成视频摘要** - 快速了解内容
5. **生成逐字稿** - 带时间戳的文字稿

可在 `batch_analysis.py` 中自定义添加。

## 📊 结果格式

任务完成后保存为 JSON：

```json
{
  "job_id": "uuid",
  "job_name": "Python教程分析",
  "status": "completed",
  "total_videos": 2,
  "completed_videos": 2,
  "failed_videos": 0,
  "results": [
    {
      "success": true,
      "video_info": {
        "bv_id": "BV1xx411xxx",
        "title": "Python入门教程",
        "duration": 1234,
        "uploader": "某UP主"
      },
      "analysis": {
        "text": "# 笔记大纲\n\n## 第一部分\n..."
      }
    }
  ],
  "errors": []
}
```

## ⚙️ 配置

### 环境变量 (.env)
```env
GEMINI_API_KEY=your_api_key_here
```

### 超时设置
```python
# 在 gemini_service.py 中
VIDEO_PROCESSING_TIMEOUT = 300  # 5分钟
CONTENT_GENERATION_TIMEOUT = 120  # 2分钟

# 在 video.py 路由中
TOTAL_ANALYSIS_TIMEOUT = 600  # 10分钟
```

### 文件大小限制
```python
# 在 gemini_service.py 中
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
```

## 🐛 调试

### 启用详细日志
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### 查看任务状态
```bash
# 查看存储的任务结果
ls -lh batch_results/
cat batch_results/latest_job.json | jq
```

### 测试单个视频
```python
from app.services.bilibili_service import BilibiliService

service = BilibiliService()
info = service.extract_video_info("BV1xx411xxx")
print(info)
```

## 🔒 安全注意事项

1. **API Key 保护**
   - 不要提交 `.env` 到版本控制
   - 使用环境变量管理敏感信息

2. **文件清理**
   - 视频文件在分析后自动删除
   - 定期清理旧的 JSON 结果

3. **速率限制**
   - Gemini API 有配额限制
   - 建议每批处理 5-10 个视频

## 📈 性能优化

### 推荐配置
- 并发下载：2
- 并发分析：1（受 API 限制）
- 视频缓存：临时目录（自动清理）

### 磁盘空间
- 预留至少 1GB 用于临时文件
- 分析结果 JSON 通常 < 1MB/任务

## 🧪 测试

### 运行完整测试
```bash
python test_bilibili_batch.py
```

### 单元测试（TODO）
```bash
pytest tests/test_bilibili_service.py
pytest tests/test_batch_analyzer.py
```

## 📝 开发计划

- [ ] 添加单元测试
- [ ] 支持播放列表批量下载
- [ ] 添加 Redis 支持（替代内存存储）
- [ ] 实现 WebSocket 实时进度推送
- [ ] 支持更多视频平台
- [ ] 添加视频字幕提取
- [ ] 优化大视频文件处理

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License


