# API 转发服务使用指南

## 📋 架构说明

项目现已将外部 API 调用统一通过独立的转发服务进行，架构如下：

```
主项目 (backend:8000)
    ↓ 调用
API 转发服务 (api-proxy:8001)
    ↓ 转发
外部服务 (ASR/LLM/文件上传)
```

## 🚀 快速启动

### 1. 启动 API 转发服务

#### 方式 1: 直接运行（开发环境）

```bash
# 进入转发服务目录
cd api-proxy

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

#### 方式 2: 使用启动脚本

**Windows:**
```bash
cd api-proxy
start.bat
```

**Linux/Mac:**
```bash
cd api-proxy
chmod +x start.sh
./start.sh
```

#### 方式 3: Docker 部署

```bash
cd api-proxy

# 构建镜像
docker build -t api-proxy:latest .

# 运行容器
docker run -d \
  --name api-proxy \
  -p 8001:8001 \
  api-proxy:latest

# 或使用 docker-compose
docker-compose up -d
```

### 2. 启动主项目

```bash
# 回到主项目目录
cd ../backend

# 确保环境变量配置了转发服务地址（可选，默认 localhost:8001）
# 在 backend/.env 中添加:
# API_PROXY_URL=http://localhost:8001

# 启动主项目
python main.py
```

## 🔧 配置说明

### API 转发服务配置

在 `api-proxy/.env` 中配置（可选，有默认值）：

```bash
# 服务端口
PORT=8001

# ASR 配置
ASR_APP_ID=1728
ASR_APP_KEY=09450965e796431cb730d04b7b784c76

# LLM 配置
BAIJIA_API_KEY=sk-7BfuPhPxtPMjaAJn86vR2g

# 文件上传配置
FILE_UPLOAD_UID=20210716
```

### 主项目配置

在 `backend/.env` 中配置转发服务地址：

```bash
# API 转发服务地址
API_PROXY_URL=http://localhost:8001

# 如果部署在其他机器，修改为实际地址
# API_PROXY_URL=http://192.168.1.100:8001
# API_PROXY_URL=https://api-proxy.example.com
```

## 📡 服务端点映射

| 原始接口 | 转发服务端点 | 说明 |
|---------|-------------|------|
| `https://tech.baijia.com/ai/tool/asr/async/create` | `http://localhost:8001/asr/create` | ASR 创建任务 |
| `https://tech.baijia.com/ai/tool/asr/async/getById` | `http://localhost:8001/asr/get?id={id}` | ASR 获取结果 |
| `https://llm.baijia.com/v1/chat/completions` | `http://localhost:8001/llm/chat` | LLM 聊天 |
| `http://internal-storage.genshuixue.com/webupload.php` | `http://localhost:8001/upload` | 文件上传 |

## 🔍 验证服务

### 1. 检查转发服务是否运行

```bash
# 访问健康检查端点
curl http://localhost:8001/health

# 查看服务信息
curl http://localhost:8001/
```

### 2. 运行测试脚本

```bash
cd api-proxy
python test_api.py
```

### 3. 查看日志

转发服务启动时会输出：

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

主项目调用时会输出：

```
📝 ASR Create Request: {...}
✅ ASR Create Response: 200
🤖 LLM Chat Request: model=xxx, messages=N
✅ LLM Chat Response: 200
```

## 🌐 生产环境部署

### 部署到远程服务器

1. **在远程服务器上部署转发服务**

```bash
# SSH 到服务器
ssh user@your-server.com

# 克隆代码
git clone https://github.com/your-repo/learnorbit.git
cd learnorbit/api-proxy

# 使用 Docker 部署
docker-compose up -d

# 或使用 systemd 服务
# 创建 /etc/systemd/system/api-proxy.service
```

2. **配置主项目环境变量**

在主项目的 `backend/.env` 中：

```bash
# 指向远程转发服务
API_PROXY_URL=http://your-server.com:8001
```

3. **防火墙配置**

确保端口 8001 在服务器防火墙中开放：

```bash
# Ubuntu/Debian
sudo ufw allow 8001

# CentOS/RHEL
sudo firewall-cmd --add-port=8001/tcp --permanent
sudo firewall-cmd --reload
```

### 使用 Nginx 反向代理（推荐）

```nginx
# /etc/nginx/sites-available/api-proxy
server {
    listen 80;
    server_name api-proxy.example.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

然后主项目配置：

```bash
API_PROXY_URL=https://api-proxy.example.com
```

## 🐛 故障排查

### 问题 1: 连接被拒绝

**症状**：主项目报错 `Connection refused to http://localhost:8001`

**解决**：
```bash
# 检查转发服务是否运行
curl http://localhost:8001/health

# 如果没有运行，启动服务
cd api-proxy
python main.py
```

### 问题 2: 404 Not Found

**症状**：请求返回 404

**解决**：
- 检查 API_PROXY_URL 配置是否正确
- 检查转发服务日志，确认请求到达
- 确认端点路径是否正确（/asr/create 而不是 /api/asr/create）

### 问题 3: 超时

**症状**：请求超时

**解决**：
- 检查转发服务与外部 API 的网络连接
- 增大超时配置（转发服务默认 300 秒）
- 检查外部 API 服务状态

## 📊 监控建议

### 1. 健康检查

```bash
# 在监控系统中配置健康检查
GET http://localhost:8001/health
```

### 2. 日志收集

转发服务会输出详细日志：

```
📝 ASR Create Request: {...}
✅ ASR Create Response: 200
❌ ASR Create Error: ...
```

建议配置日志收集工具（如 Filebeat、Fluentd）。

### 3. 性能指标

监控以下指标：
- 请求响应时间
- 成功率
- 错误率
- 并发连接数

## 🔐 安全建议

1. **不要暴露敏感信息**
   - 不要提交 `.env` 文件到 Git
   - 使用环境变量管理密钥

2. **生产环境使用 HTTPS**
   - 配置 SSL 证书
   - 使用 Nginx 反向代理

3. **添加访问控制**
   - 配置 IP 白名单
   - 使用 API Key 认证

4. **限流保护**
   - 配置请求频率限制
   - 防止 API 滥用

## 💡 优势

使用独立转发服务的好处：

1. ✅ **集中管理**：所有外部 API 配置在一处
2. ✅ **灵活部署**：可独立部署到其他机器
3. ✅ **统一监控**：集中监控所有外部 API 调用
4. ✅ **易于切换**：需要更换 API 时只修改转发服务
5. ✅ **降低耦合**：主项目不直接依赖外部 API
6. ✅ **安全隔离**：敏感 API Key 只在转发服务中

## 📝 总结

- **开发环境**：两个服务都在本地运行（8000 + 8001）
- **生产环境**：转发服务可部署到独立服务器
- **配置文件**：
  - `api-proxy/.env` - 转发服务配置
  - `backend/.env` - 主项目配置（包含 API_PROXY_URL）
- **端口**：
  - 主项目：8000
  - 转发服务：8001



