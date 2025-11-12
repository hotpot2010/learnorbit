# API 转发服务

统一转发 ASR、LLM、文件上传等外部接口请求的独立服务。

## 📋 功能

转发以下 3 个外部接口：

1. **ASR 语音识别** - 百家科技 ASR 服务
2. **LLM 文本生成** - 百家 LLM API
3. **文件上传** - 内部文件存储服务

## 🚀 快速开始

### 1. 安装依赖

```bash
cd api-proxy
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `env.example` 为 `.env`：

```bash
cp env.example .env
```

编辑 `.env` 文件，填入实际配置（默认值已经配置好，通常无需修改）。

### 3. 启动服务

```bash
python main.py
```

默认运行在 `http://localhost:8001`

## 📡 API 端点

### 健康检查

```bash
GET http://localhost:8001/
GET http://localhost:8001/health
```

### 1. ASR 接口

#### 创建 ASR 任务

```bash
POST http://localhost:8001/asr/create
Content-Type: application/json

{
  "contentType": 2,
  "bizId": "test",
  "content": "{\"audioList\":[\"http://example.com/audio.mp4\"]}",
  "contentScenario": 9,
  "contentSource": "bilibili",
  "creator": "user"
}
```

**原始接口**：`https://tech.baijia.com/ai/tool/asr/async/create`

#### 获取 ASR 结果

```bash
GET http://localhost:8001/asr/get?id={task_id}
```

**原始接口**：`https://tech.baijia.com/ai/tool/asr/async/getById`

### 2. LLM 接口

```bash
POST http://localhost:8001/llm/chat
Content-Type: application/json

{
  "model": "claude-4.5-sonnet",
  "messages": [
    {
      "role": "user",
      "content": "你好"
    }
  ],
  "temperature": 0.7
}
```

**原始接口**：`https://llm.baijia.com/v1/chat/completions`

### 3. 文件上传接口

```bash
POST http://localhost:8001/upload
Content-Type: multipart/form-data

files: [file1, file2, ...]
uid: 20210716 (可选)
```

**原始接口**：`http://internal-storage.genshuixue.com/webupload.php`

**响应示例**：

```json
{
  "code": 0,
  "files": [
    {
      "key": "file0",
      "url": "path/to/uploaded/file.mp4"
    }
  ]
}
```

## 🔧 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `8001` | 服务端口 |
| `ASR_APP_ID` | `1728` | ASR 应用 ID |
| `ASR_APP_KEY` | `09450965e796431cb730d04b7b784c76` | ASR 应用密钥 |
| `BAIJIA_API_KEY` | `sk-7BfuPhPxtPMjaAJn86vR2g` | 百家 LLM API Key |
| `FILE_UPLOAD_UID` | `20210716` | 文件上传用户 ID |

### 认证方式

- **ASR**：请求头 `app-key`
- **LLM**：请求头 `Authorization: Bearer {api_key}`
- **文件上传**：表单字段 `uid`

## 🐳 Docker 部署

### 构建镜像

```bash
docker build -t api-proxy:latest .
```

### 运行容器

```bash
docker run -d \
  --name api-proxy \
  -p 8001:8001 \
  -e PORT=8001 \
  -e ASR_APP_ID=1728 \
  -e ASR_APP_KEY=your_key \
  -e BAIJIA_API_KEY=your_key \
  -e FILE_UPLOAD_UID=20210716 \
  api-proxy:latest
```

## 📊 日志输出

服务启动时会输出：

```
============================================================
🚀 API Proxy Service Started
============================================================
📍 ASR Service: https://tech.baijia.com/ai/tool/asr/async
📍 LLM Service: https://llm.baijia.com/v1/chat/completions
📍 File Upload: http://internal-storage.genshuixue.com/webupload.php
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8001
```

请求日志示例：

```
📝 ASR Create Request: {...}
✅ ASR Create Response: 200

🤖 LLM Chat Request: model=claude-4.5-sonnet, messages=1
✅ LLM Chat Response: 200

📤 File Upload Request: 1 file(s), uid=20210716
✅ File Upload Response: 200
```

## 🔒 安全建议

1. **不要将 `.env` 文件提交到 Git**
2. **生产环境使用反向代理**（如 Nginx）
3. **启用 HTTPS**
4. **添加 IP 白名单**（如果需要）
5. **定期更换 API Key**

## 🚦 健康检查

### Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8001
  initialDelaySeconds: 10
  periodSeconds: 5

readinessProbe:
  httpGet:
    path: /health
    port: 8001
  initialDelaySeconds: 5
  periodSeconds: 3
```

### Docker Compose

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 📈 性能优化

- **超时配置**：300 秒总超时，60 秒连接超时
- **异步处理**：所有请求使用 `httpx.AsyncClient`
- **连接复用**：全局 HTTP 客户端复用连接

## 🐛 故障排查

### 问题 1：ASR 请求失败

检查：
- `ASR_APP_ID` 和 `ASR_APP_KEY` 是否正确
- 请求体格式是否正确
- 音频 URL 是否可访问

### 问题 2：LLM 请求失败

检查：
- `BAIJIA_API_KEY` 是否正确
- 请求体中的 `model` 是否支持
- 是否有余额

### 问题 3：文件上传失败

检查：
- 文件大小是否超过限制
- 内部存储服务是否可访问
- `uid` 是否正确

## 📝 更新日志

### v1.0.0 (2025-11-11)

- ✅ 初始版本
- ✅ 支持 ASR 接口转发
- ✅ 支持 LLM 接口转发
- ✅ 支持文件上传接口转发
- ✅ 添加健康检查端点
- ✅ 添加详细日志输出

## 📞 联系方式

如有问题，请联系开发团队。


