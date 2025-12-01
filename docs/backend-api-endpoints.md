# Backend API 接口文档

## 基础信息

- **Base URL**: `http://localhost:8000` (开发环境)
- **API 前缀**: `/open-api`
- **文档地址**: 
  - Swagger UI: `http://localhost:8000/docs`
  - ReDoc: `http://localhost:8000/redoc`
  - OpenAPI JSON: `http://localhost:8000/openapi.json`

---

## 1. 视频分析 API (`/open-api/api/v1/video`)

### 1.1 健康检查
- **端点**: `GET /open-api/api/v1/video/health`
- **描述**: 检查服务运行状态
- **响应**:
```json
{
  "status": "healthy" | "degraded",
  "message": "All services operational",
  "timestamp": "2024-01-01T00:00:00"
}
```

### 1.2 获取分析类型
- **端点**: `GET /open-api/api/v1/video/analysis-types`
- **描述**: 获取支持的视频分析类型
- **响应**:
```json
{
  "analysis_types": [
    {"value": "general", "label": "通用分析"},
    {"value": "educational", "label": "教育分析"},
    {"value": "summary", "label": "内容摘要"},
    {"value": "quiz", "label": "测试生成"}
  ],
  "descriptions": {
    "general": "全面分析视频内容",
    "educational": "教育价值分析",
    "summary": "内容摘要生成",
    "quiz": "测试题目生成"
  }
}
```

### 1.3 上传并分析视频
- **端点**: `POST /open-api/api/v1/video/upload-and-analyze`
- **描述**: 上传视频文件并进行 AI 分析
- **请求类型**: `multipart/form-data`
- **参数**:
  - `file` (File, required): 视频文件
  - `analysis_type` (Form, optional): 分析类型，默认为 `general`
  - `custom_prompt` (Form, optional): 自定义提示词
- **响应**:
```json
{
  "success": true,
  "analysis": "...",
  "timestamp": "2024-01-01T00:00:00"
}
```

### 1.4 通过路径分析视频
- **端点**: `POST /open-api/api/v1/video/analyze-by-path`
- **描述**: 通过文件路径分析本地视频
- **请求体**:
```json
{
  "video_path": "/path/to/video.mp4",
  "analysis_type": "general",
  "custom_prompt": "可选的自定义提示词"
}
```

---

## 2. 批量分析 API (`/open-api/batch`)

### 2.1 获取提示词模板
- **端点**: `GET /open-api/batch/templates`
- **描述**: 获取所有可用的提示词模板
- **响应**: 提示词模板列表

### 2.2 获取视频信息
- **端点**: `POST /open-api/batch/video-info`
- **描述**: 提取视频信息（不下载）
- **请求体**:
```json
{
  "url": "https://www.bilibili.com/video/BV..."
}
```

### 2.3 创建批量分析任务
- **端点**: `POST /open-api/batch/jobs`
- **描述**: 创建新的批量分析任务
- **请求体**:
```json
{
  "video_urls": ["https://www.bilibili.com/video/BV..."],
  "prompt": "分析视频内容",
  "job_name": "任务名称（可选）",
  "locale": "zh" | "en"
}
```
- **响应**:
```json
{
  "success": true,
  "job_id": "uuid",
  "message": "Job created and started"
}
```

### 2.4 获取任务状态
- **端点**: `GET /open-api/batch/jobs/{job_id}`
- **描述**: 获取任务状态和进度
- **响应**:
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "pending" | "running" | "completed" | "failed",
    "progress": 0-100,
    "total_videos": 5,
    "completed_videos": 3,
    "failed_videos": 0,
    "results": [...]
  }
}
```

### 2.5 列出所有任务
- **端点**: `GET /open-api/batch/jobs`
- **描述**: 列出所有活跃的任务

### 2.6 分析单个分集
- **端点**: `POST /open-api/batch/analyze-part`
- **描述**: 分析系列视频的单个分集
- **请求体**:
```json
{
  "video_url": "https://www.bilibili.com/video/BV...",
  "prompt": "分析内容",
  "part_number": 1,
  "quality": "best" | "1080p" | "720p" | "480p" | "360p" | "audio",
  "locale": "zh" | "en"
}
```

### 2.7 获取播放链接
- **端点**: `POST /open-api/batch/get-play-url`
- **描述**: 获取视频播放链接（B站 CDN 链接有时效性）
- **请求体**:
```json
{
  "video_url": "https://www.bilibili.com/video/BV...",
  "quality": "best"
}
```

### 2.8 缓存管理

#### 2.8.1 获取缓存统计
- **端点**: `GET /open-api/batch/cache/stats`
- **描述**: 获取缓存统计信息

#### 2.8.2 列出缓存
- **端点**: `GET /open-api/batch/cache/list`
- **描述**: 列出所有缓存的视频

#### 2.8.3 清理过期缓存
- **端点**: `POST /open-api/batch/cache/clear-expired`
- **描述**: 清理过期的缓存条目
- **查询参数**: `max_age_hours` (默认: 24)

#### 2.8.4 清理所有缓存
- **端点**: `POST /open-api/batch/cache/clear-all`
- **描述**: 清理所有缓存条目

---

## 3. 笔记生成 API (`/open-api/notes`)

### 3.1 生成笔记
- **端点**: `POST /open-api/notes/generate`
- **描述**: 为特定知识点生成笔记
- **请求体**:
```json
{
  "knowledge_point_name": "知识点名称",
  "transcript_segment": "逐字稿片段",
  "video_title": "视频标题（可选）",
  "video_url": "视频URL（可选，用于缓存）",
  "locale": "zh" | "en"
}
```
- **响应**:
```json
{
  "success": true,
  "note": "Markdown格式的笔记内容",
  "from_cache": false
}
```

### 3.2 回答问题
- **端点**: `POST /open-api/notes/answer-question`
- **描述**: 回答用户关于特定知识点的问题
- **请求体**:
```json
{
  "question": "用户问题",
  "knowledge_point_name": "知识点名称",
  "transcript_segment": "上下文逐字稿",
  "video_title": "视频标题（可选）",
  "video_url": "视频URL（可选）",
  "locale": "zh" | "en"
}
```
- **响应**:
```json
{
  "success": true,
  "answer": "AI生成的回答"
}
```

### 3.3 生成练习题
- **端点**: `POST /open-api/notes/generate-exercise`
- **描述**: 为特定知识点生成编程练习题
- **请求体**:
```json
{
  "knowledge_point_name": "知识点名称",
  "transcript_segment": "上下文逐字稿",
  "video_title": "视频标题（可选）",
  "video_url": "视频URL（可选）",
  "locale": "zh" | "en"
}
```
- **响应**:
```json
{
  "success": true,
  "exercise": {
    "type": "fill_blank" | "guided_steps" | "code_choice" | "complete",
    "title": "练习题标题",
    "description": "题目描述",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "language": "python" | "javascript" | "...",
    "starter_code": "初始代码模板",
    "solution": "参考答案",
    "hints": ["提示1", "提示2"]
  },
  "from_cache": false
}
```

### 3.4 执行代码
- **端点**: `POST /open-api/notes/execute-code`
- **描述**: 执行代码
- **请求体**:
```json
{
  "code": "代码内容",
  "language": "python" | "javascript" | "...",
  "test_inputs": ["输入1", "输入2"] // 可选
}
```
- **响应**:
```json
{
  "success": true,
  "output": "执行输出",
  "exit_code": 0,
  "warning": "警告信息（可选）"
}
```

### 3.5 验证答案
- **端点**: `POST /open-api/notes/validate-answer`
- **描述**: 验证用户提交的代码答案
- **请求体**:
```json
{
  "user_code": "用户提交的代码",
  "exercise": {
    "type": "fill_blank",
    "title": "题目标题",
    "description": "题目描述",
    "difficulty": "beginner",
    "language": "python",
    "starter_code": "初始代码",
    "solution": "参考答案",
    "hints": ["提示1"]
  },
  "language": "python",
  "video_url": "视频URL（可选）",
  "knowledge_point_name": "知识点名称（可选）"
}
```
- **响应**:
```json
{
  "success": true,
  "passed": true,
  "score": 85,
  "feedback": "评估反馈",
  "test_results": null
}
```

---

## 4. 文件上传 API (`/open-api/upload`)

### 4.1 文件上传（透传）
- **端点**: `POST /open-api/upload`
- **描述**: 透传文件上传请求到 api-proxy，支持单文件和多文件上传
- **请求类型**: `multipart/form-data`
- **参数**:
  - `file0`, `file1`, ... 或任意字段名 (File, required): 要上传的文件
  - `uid` (Form, optional): 上传用户ID，默认为 api-proxy 的默认值
- **响应**:
```json
{
  "code": 0,
  "data": {
    "url": "文件访问URL",
    "path": "文件路径"
  }
}
```
- **注意事项**:
  - 此接口透传到 api-proxy 的文件上传服务
  - 需要配置 `API_PROXY_URL` 环境变量（默认: `http://localhost:8001`）
  - 支持上传多个文件，使用不同的字段名即可
  - 超时时间：300秒（5分钟）

---

## 5. 视频搜索 API (`/open-api/video-search`)

### 5.1 搜索视频
- **端点**: `POST /open-api/video-search/search`
- **描述**: 搜索视频并进行 LLM 分析
- **请求体**:
```json
{
  "query": "搜索关键词",
  "limit": 10,  // 最多10个结果
  "locale": "zh" | "en"  // 中文：B站，英文：YouTube
}
```
- **响应**:
```json
{
  "success": true,
  "videos": [
    {
      "title": "视频标题",
      "url": "视频URL",
      "cover": "封面URL",
      "duration": "时长",
      "play_count": "播放量",
      "is_series": false,
      "video_amount": 1,
      "analysis": "LLM分析结果"
    }
  ],
  "total": 10,
  "message": "找到 10 个相关视频"
}
```

### 5.2 测试接口
- **端点**: `GET /open-api/video-search/test`
- **描述**: 测试接口是否可用

---

## 6. 静态文件服务

### 5.1 静态文件访问
- **端点**: `GET /static/{file_path}`
- **描述**: 访问上传的静态文件（CDN服务）
- **示例**: `GET /static/videos/video.mp4`

---

## 7. 根端点

### 6.1 API 信息
- **端点**: `GET /open-api` 或 `GET /open-api/`
- **描述**: 获取 API 基本信息
- **响应**:
```json
{
  "message": "Video Analysis API",
  "version": "1.0.0",
  "docs": "/docs",
  "health": "/open-api/api/v1/video/health"
}
```

### 6.2 主页
- **端点**: `GET /`
- **描述**: HTML 欢迎页面

---

## 错误响应格式

所有接口在出错时都会返回以下格式：

```json
{
  "detail": "错误描述信息"
}
```

常见 HTTP 状态码：
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源未找到
- `408`: 请求超时
- `500`: 服务器内部错误
- `503`: 服务不可用（如 Gemini API 未配置）

---

## 注意事项

1. **语言环境 (`locale`)**:
   - `zh`: 中文模式，使用 B站搜索和中文提示词
   - `en`: 英文模式，使用 YouTube 搜索和英文提示词

2. **视频质量 (`quality`)**:
   - `best`: 最佳质量
   - `1080p`, `720p`, `480p`, `360p`: 指定清晰度
   - `audio`: 仅音频

3. **缓存机制**:
   - 笔记生成和练习题生成支持缓存
   - 缓存键基于 `video_url` 和 `knowledge_point_name`

4. **超时设置**:
   - 视频分析默认超时：10分钟
   - 批量任务在后台异步执行

5. **文件上传限制**:
   - 最大文件大小：100MB
   - 支持的视频格式：MP4, AVI, MOV, MKV, WebM 等


