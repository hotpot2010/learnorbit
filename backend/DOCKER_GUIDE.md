# 🐳 Backend Docker 部署指南

## 📋 概述

本文档介绍如何使用 Docker 容器化部署 LearnOrbit Backend 服务。

## 🏗️ Docker 架构

### 多阶段构建

Dockerfile 采用多阶段构建优化镜像大小：

1. **Builder Stage** - 编译和安装依赖
2. **Final Stage** - 轻量级运行时镜像

### 镜像特性

- ✅ **基础镜像**: `python:3.10-slim`
- ✅ **FFmpeg 支持**: 用于视频处理
- ✅ **虚拟环境**: 依赖隔离
- ✅ **非 root 用户**: 安全运行
- ✅ **健康检查**: 自动监控服务状态
- ✅ **多 worker**: 提高并发性能

## 🚀 快速开始

### 1. 准备环境变量

创建 `.env` 文件（如果还没有）：

```bash
cd backend
cp env.example .env
```

编辑 `.env` 文件，填入必需的配置：

```env
# 火山引擎配置（必需）
VOLC_ACCESS_KEY=your_access_key
VOLC_SECRET_KEY=your_secret_key
VOLC_CHAT_MODEL=your_model_endpoint

# Gemini 配置（可选）
GEMINI_API_KEY=your_gemini_key
```

### 2. 构建镜像

```bash
cd backend
docker build -t learnorbit-backend:latest .
```

### 3. 运行容器

#### 方式 A: 使用 docker run

```bash
docker run -d \
  --name learnorbit-backend \
  -p 8000:8000 \
  -e VOLC_ACCESS_KEY="your_access_key" \
  -e VOLC_SECRET_KEY="your_secret_key" \
  -e VOLC_CHAT_MODEL="your_model" \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/cache:/app/cache \
  -v $(pwd)/batch_results:/app/batch_results \
  learnorbit-backend:latest
```

#### 方式 B: 使用 docker-compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

### 4. 验证部署

访问以下 URL 验证服务是否正常：

- **健康检查**: http://localhost:8000/health
- **API 文档**: http://localhost:8000/docs
- **根路径**: http://localhost:8000/

## 📂 目录结构

### 容器内目录

```
/app/
├── app/                    # 应用代码
│   ├── api/               # API 路由
│   ├── core/              # 核心配置
│   ├── models/            # 数据模型
│   ├── services/          # 业务服务
│   └── utils/             # 工具函数
├── uploads/               # 上传文件（挂载）
├── cache/                 # 缓存目录（挂载）
├── batch_results/         # 批量任务结果（挂载）
├── logs/                  # 日志目录（挂载）
└── main.py               # 入口文件
```

### 数据持久化

以下目录通过 volume 挂载，数据持久化到宿主机：

| 容器路径 | 宿主机路径 | 说明 |
|---------|-----------|------|
| `/app/uploads` | `./uploads` | 上传的视频文件 |
| `/app/cache` | `./cache` | ASR、笔记、练习缓存 |
| `/app/batch_results` | `./batch_results` | 批量分析结果 |
| `/app/logs` | `./logs` | 应用日志 |

## 🔧 常用命令

### Docker 命令

```bash
# 构建镜像
docker build -t learnorbit-backend:latest .

# 构建时不使用缓存
docker build --no-cache -t learnorbit-backend:latest .

# 运行容器
docker run -d --name learnorbit-backend -p 8000:8000 learnorbit-backend:latest

# 查看容器日志
docker logs -f learnorbit-backend

# 进入容器
docker exec -it learnorbit-backend bash

# 停止容器
docker stop learnorbit-backend

# 删除容器
docker rm learnorbit-backend

# 删除镜像
docker rmi learnorbit-backend:latest

# 查看容器资源使用
docker stats learnorbit-backend
```

### Docker Compose 命令

```bash
# 启动服务（后台）
docker-compose up -d

# 启动服务（前台，查看日志）
docker-compose up

# 停止服务
docker-compose down

# 停止并删除 volumes
docker-compose down -v

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f backend

# 查看服务状态
docker-compose ps

# 重新构建并启动
docker-compose up -d --build
```

## 🔍 健康检查

容器包含自动健康检查：

- **检查间隔**: 30秒
- **超时时间**: 10秒
- **启动等待**: 60秒
- **重试次数**: 3次
- **检查端点**: `/health`

查看健康状态：

```bash
docker inspect --format='{{.State.Health.Status}}' learnorbit-backend
```

## 🐛 故障排查

### 问题 1: 容器无法启动

```bash
# 查看容器日志
docker logs learnorbit-backend

# 可能原因：
# 1. 端口 8000 已被占用
# 2. 环境变量配置错误
# 3. 依赖安装失败
```

### 问题 2: 环境变量未生效

```bash
# 检查容器环境变量
docker exec learnorbit-backend env | grep VOLC

# 确保 .env 文件存在且格式正确
# 或在 docker-compose.yml 中正确配置
```

### 问题 3: 文件权限问题

```bash
# 检查挂载目录权限
ls -la uploads/ cache/ batch_results/

# 修改权限（如果需要）
chmod -R 755 uploads/ cache/ batch_results/
```

### 问题 4: FFmpeg 不可用

```bash
# 进入容器检查
docker exec -it learnorbit-backend bash
ffmpeg -version

# 如果不可用，重新构建镜像
docker-compose build --no-cache
```

### 问题 5: 内存不足

```bash
# 增加 docker-compose.yml 中的内存限制
deploy:
  resources:
    limits:
      memory: 8G  # 根据需求调整
```

## 📊 性能优化

### 1. 多 worker 配置

默认配置使用 2 个 worker，可根据 CPU 核心数调整：

```dockerfile
# Dockerfile 中修改
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

或在 docker-compose.yml 中覆盖：

```yaml
command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 2. 资源限制

在 `docker-compose.yml` 中配置：

```yaml
deploy:
  resources:
    limits:
      cpus: '4'      # 最大 4 核
      memory: 8G     # 最大 8GB 内存
    reservations:
      cpus: '2'      # 预留 2 核
      memory: 4G     # 预留 4GB 内存
```

### 3. 缓存优化

确保 cache 目录正确挂载，避免重复处理：

```bash
# 查看缓存使用情况
du -sh cache/*
```

## 🔐 安全建议

1. **不要硬编码敏感信息** - 使用环境变量或 secrets
2. **使用非 root 用户** - Dockerfile 已配置 `appuser`
3. **定期更新基础镜像** - `docker pull python:3.10-slim`
4. **限制容器资源** - 防止资源耗尽
5. **启用健康检查** - 自动检测服务异常

## 📝 生产环境部署

### 1. 使用环境变量文件

```bash
# 创建生产环境配置
cat > .env.production << EOF
VOLC_ACCESS_KEY=prod_key
VOLC_SECRET_KEY=prod_secret
VOLC_CHAT_MODEL=prod_model
DEBUG=False
EOF

# 使用指定环境文件启动
docker-compose --env-file .env.production up -d
```

### 2. 启用 HTTPS

使用 Nginx 反向代理：

```nginx
server {
    listen 443 ssl;
    server_name api.learnorbit.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 日志管理

配置日志驱动：

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 4. 自动重启策略

```yaml
restart: unless-stopped  # 除非手动停止，否则自动重启
```

## 🎯 镜像优化

当前镜像大小约 **500-800 MB**，已经相当优化。

进一步优化建议：

1. **使用 alpine 基础镜像** - 更小但兼容性可能受影响
2. **清理不必要的依赖** - 检查 requirements.txt
3. **使用 multi-stage build** - 已实现
4. **压缩层数** - 合并 RUN 命令

## 📚 参考资源

- [Docker 官方文档](https://docs.docker.com/)
- [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/)
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

---

**更新时间**: 2025-01-07  
**Docker 版本**: 20.10+  
**Docker Compose 版本**: 2.0+  
**状态**: ✅ 生产就绪

