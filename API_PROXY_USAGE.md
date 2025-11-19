# API 转发服务使用说明

## 📖 概述

已将 ASR、LLM、文件上传三个外部接口封装到独立的 API 转发服务中。

## 🚀 启动方式

### 方式 1: 本地启动（推荐开发环境）

```bash
# 1. 进入转发服务目录
cd api-proxy

# 2. 创建虚拟环境（首次）
python -m venv venv

# 3. 激活虚拟环境
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 启动服务
python main.py
```

**或使用启动脚本**：

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

**服务地址**：`http://localhost:8001`

### 方式 2: Docker 启动（推荐生产环境）

```bash
cd api-proxy

# 使用 docker-compose
docker-compose up -d

# 或直接使用 docker
docker build -t api-proxy .
docker run -d -p 8001:8001 --name api-proxy api-proxy
```

## 🔧 配置说明

### 1. 转发服务配置

在 `api-proxy/.env` 中配置（可选，已有默认值）：

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

### 2. 主项目配置

在 `backend/.env` 中添加：

```bash
# API 转发服务地址
API_PROXY_URL=http://localhost:8001

# 生产环境示例
# API_PROXY_URL=http://api-proxy.your-domain.com
```

## 📡 服务架构

### 原来的调用方式

```
Backend Service
  ├── ASR Service → https://tech.baijia.com/ai/tool/asr/async/*
  ├── LLM Service → https://llm.baijia.com/v1/chat/completions
  └── File Upload → http://internal-storage.genshuixue.com/webupload.php
```

### 现在的调用方式

```
Backend Service → API Proxy Service (localhost:8001) → External APIs
                      ├── /asr/create
                      ├── /asr/get
                      ├── /llm/chat
                      └── /upload
```

## 🎯 转发服务端点

| 原始接口 | 转发端点 | 说明 |
|---------|----------|------|
| `https://tech.baijia.com/ai/tool/asr/async/create` | `POST /asr/create` | 创建 ASR 任务 |
| `https://tech.baijia.com/ai/tool/asr/async/getById` | `GET /asr/get?id=xxx` | 获取 ASR 结果 |
| `https://llm.baijia.com/v1/chat/completions` | `POST /llm/chat` | LLM 聊天 |
| `http://internal-storage.genshuixue.com/webupload.php` | `POST /upload` | 文件上传 |

## 🧪 测试

### 1. 健康检查

```bash
curl http://localhost:8001/health
```

**响应**：

```json
{
  "status": "ok"
}
```

### 2. 运行测试脚本

```bash
cd api-proxy
python test_api.py
```

### 3. 测试主项目

```bash
cd backend

# 启动主服务
python main.py

# 访问视频分析功能，观察日志
```

**日志示例**：

```
📤 File upload service initialized
📍 Upload URL: http://localhost:8001/upload

📝 Creating ASR task for audio: http://...
🔄 ASR Task created: {...}

🤖 LLM Chat Request: model=claude-4.5-sonnet, messages=1
✅ LLM Chat Response: 200
```

## 🔒 生产环境部署

### 1. 独立服务器部署

```bash
# 在独立服务器上
cd api-proxy

# 使用 systemd 管理服务
sudo nano /etc/systemd/system/api-proxy.service
```

**服务配置**：

```ini
[Unit]
Description=API Proxy Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/api-proxy
Environment="PATH=/path/to/api-proxy/venv/bin"
ExecStart=/path/to/api-proxy/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**启动服务**：

```bash
sudo systemctl daemon-reload
sudo systemctl enable api-proxy
sudo systemctl start api-proxy
sudo systemctl status api-proxy
```

### 2. 使用 Nginx 反向代理

```nginx
upstream api_proxy {
    server localhost:8001;
}

server {
    listen 80;
    server_name api-proxy.your-domain.com;

    location / {
        proxy_pass http://api_proxy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

### 3. 主项目配置生产环境

在主项目 `backend/.env` 中：

```bash
# 使用生产环境的转发服务地址
API_PROXY_URL=http://api-proxy.your-domain.com
# 或内网地址
API_PROXY_URL=http://192.168.1.100:8001
```

## 📊 监控和日志

### 查看转发服务日志

```bash
# 本地运行
# 直接在终端查看

# Docker 运行
docker logs -f api-proxy

# systemd 运行
sudo journalctl -u api-proxy -f
```

### 日志示例

```
============================================================
🚀 API Proxy Service Started
============================================================
📍 ASR Service: https://tech.baijia.com/ai/tool/asr/async
📍 LLM Service: https://llm.baijia.com/v1/chat/completions
📍 File Upload: http://internal-storage.genshuixue.com/webupload.php
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8001

📝 ASR Create Request: {...}
✅ ASR Create Response: 200

🤖 LLM Chat Request: model=claude-4.5-sonnet, messages=1
✅ LLM Chat Response: 200
```

## ⚠️ 故障排查

### 问题 1: 转发服务无法启动

**检查**：
- 端口 8001 是否被占用
- 依赖是否安装完整

**解决**：

```bash
# 检查端口
netstat -ano | findstr :8001  # Windows
lsof -i :8001                 # Linux/Mac

# 重新安装依赖
cd api-proxy
pip install -r requirements.txt --force-reinstall
```

### 问题 2: 主项目无法连接转发服务

**检查**：
- 转发服务是否正常运行
- `API_PROXY_URL` 环境变量是否配置正确
- 网络是否可达

**解决**：

```bash
# 测试连接
curl http://localhost:8001/health

# 检查环境变量
cd backend
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('API_PROXY_URL'))"
```

### 问题 3: ASR/LLM 请求失败

**检查**：
- 转发服务中的 API Key 是否正确
- 外部服务是否可访问

**解决**：

```bash
# 查看转发服务日志
# 检查是否有错误信息

# 直接测试外部接口
curl -X POST https://llm.baijia.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-4.5-sonnet","messages":[{"role":"user","content":"test"}]}'
```

## 🔐 安全建议

1. **不要将 `.env` 文件提交到 Git**
2. **生产环境使用 HTTPS**
3. **添加 IP 白名单**（如果需要）
4. **定期更换 API Key**
5. **使用防火墙限制访问**

## 📈 性能优化

- **超时配置**: 默认 300 秒，可根据实际需求调整
- **并发处理**: 使用 `uvicorn --workers 4` 启动多进程
- **负载均衡**: 部署多个转发服务实例，使用 Nginx 负载均衡

## 🎯 总结

### 优势

✅ **统一管理**: 所有外部接口调用集中管理  
✅ **易于维护**: 修改接口配置无需重启主服务  
✅ **独立部署**: 可部署到专用服务器，减轻主服务压力  
✅ **灵活扩展**: 可添加更多转发接口  
✅ **环境隔离**: 本地、测试、生产环境可使用不同的转发服务

### 下一步

1. ✅ 启动转发服务
2. ✅ 配置主项目使用转发服务
3. 🔲 测试所有功能是否正常
4. 🔲 根据需要部署到生产环境

