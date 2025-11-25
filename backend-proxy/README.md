# Backend API 转发服务

将所有请求转发到指定的后端服务器。

## 功能特性

- ✅ 支持所有 HTTP 方法（GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD）
- ✅ 支持文件上传（multipart/form-data）
- ✅ 支持 JSON 请求
- ✅ 支持查询参数和请求头转发
- ✅ 自动处理响应内容类型
- ✅ CORS 支持
- ✅ 健康检查端点

## 快速开始

### 1. 安装依赖

```bash
cd backend-proxy
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并修改配置：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```bash
# 目标服务器地址
TARGET_SERVER=http://172.20.240.235:8000

# 代理服务端口
PROXY_PORT=8002
```

### 3. 启动服务

```bash
python main.py
```

或者使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8002
```

## 使用方式

### 直接访问

所有请求路径保持不变，只需将目标地址改为代理服务器：

**原始请求：**
```
POST http://172.20.240.235:8000/open-api/batch/jobs
```

**通过代理：**
```
POST http://localhost:8002/open-api/batch/jobs
```

### 健康检查

```bash
curl http://localhost:8002/health
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `TARGET_SERVER` | 目标后端服务器地址 | `http://172.20.240.235:8000` |
| `PROXY_PORT` | 代理服务端口 | `8002` |

## 支持的请求类型

### JSON 请求
```bash
curl -X POST http://localhost:8002/open-api/notes/generate-note \
  -H "Content-Type: application/json" \
  -d '{"knowledge_point_name": "test", "transcript_segment": "test"}'
```

### 文件上传
```bash
curl -X POST http://localhost:8002/open-api/api/v1/video/upload-and-analyze \
  -F "file=@video.mp4"
```

### GET 请求
```bash
curl http://localhost:8002/open-api/batch/jobs/12345
```

## 日志

服务会输出详细的转发日志：

```
🔄 [POST] /open-api/batch/jobs -> http://172.20.240.235:8000/open-api/batch/jobs
✅ Response: 200
```

## 错误处理

- **502 Bad Gateway**: 无法连接到目标服务器
- **504 Gateway Timeout**: 目标服务器响应超时
- **500 Internal Server Error**: 代理服务内部错误

## Docker 部署

### 构建镜像

```bash
docker build -t backend-proxy:latest .
```

### 运行容器

```bash
docker run -d \
  --name backend-proxy \
  -p 8002:8002 \
  -e TARGET_SERVER=http://172.20.240.235:8000 \
  backend-proxy:latest
```

## 注意事项

1. 代理服务会转发所有请求头，但会排除一些不需要的头（如 `host`, `content-length`）
2. 文件上传请求会自动处理 multipart/form-data
3. 响应内容类型会自动识别（JSON 或二进制）
4. 建议在生产环境中使用 HTTPS

