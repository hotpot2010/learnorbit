# API Proxy 快速开始

## ✅ 完成的更改

### 1. 所有接口已添加 `/open-api` 前缀

**新的接口路径：**
- `/open-api/health` - 健康检查
- `/open-api/test` - 测试页面
- `/open-api/asr/create` - ASR 创建
- `/open-api/asr/get` - ASR 查询  
- `/open-api/llm/chat` - LLM 对话
- `/open-api/upload` - 文件上传

### 2. 已更新的文件

#### API Proxy 服务
- ✅ `api-proxy/main.py` - 使用 APIRouter 添加统一前缀
- ✅ `api-proxy/test.html` - 测试页面 URL 已更新
- ✅ `api-proxy/test_curl.bat` - Windows 测试脚本已更新
- ✅ `api-proxy/test_curl.sh` - Linux/Mac 测试脚本已更新

#### 主项目后端
- ✅ `backend/app/services/asr_service.py` - ASR 接口路径已更新
- ✅ `backend/app/services/doubao_service.py` - LLM 接口路径已更新
- ✅ `backend/app/services/file_upload_service.py` - 文件上传路径已更新

## 🚀 启动服务

### 1. 启动 API Proxy

```bash
cd api-proxy
python main.py
```

启动后会显示：
```
============================================================
🚀 API Proxy Service Started
============================================================
📍 Base Path: /open-api
📍 ASR Service: https://tech.baijia.com/ai/tool/asr/async
📍 LLM Service: https://llm.baijia.com/v1/chat/completions
📍 File Upload: http://internal-storage.genshuixue.com/webupload.php
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

### 2. 启动主项目后端

```bash
cd backend
python main.py
```

## 🧪 测试

### 方法 1：浏览器测试（推荐）

打开浏览器访问：
```
http://localhost:8001/open-api/test
```

### 方法 2：Curl 命令测试

**最简单的测试：**
```bash
curl http://localhost:8001/open-api/health
```

**预期响应：**
```json
{
  "status": "ok",
  "message": "API Proxy Service is running"
}
```

### 方法 3：运行测试脚本

**Windows:**
```cmd
cd api-proxy
test_curl.bat
```

**Linux/Mac:**
```bash
cd api-proxy
chmod +x test_curl.sh
./test_curl.sh
```

## 📊 完整的 Curl 测试命令

### 1. 健康检查
```bash
curl http://localhost:8001/open-api/health
```

### 2. ASR 创建
```bash
curl -X POST http://localhost:8001/open-api/asr/create \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/test.mp3","callbackUrl":"https://example.com/cb"}'
```

### 3. ASR 查询
```bash
curl "http://localhost:8001/open-api/asr/get?id=test-task-123"
```

### 4. LLM 对话
```bash
curl -X POST http://localhost:8001/open-api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-4.5-sonnet","messages":[{"role":"user","content":"Hello"}],"max_tokens":50}'
```

### 5. 文件上传
```bash
# 先创建测试文件
echo "test content" > test.txt

# 上传
curl -X POST http://localhost:8001/open-api/upload \
  -F "file=@test.txt" \
  -F "uid=20210716"
```

## ⚙️ 配置

### 修改端口

在 `api-proxy/.env` 中：
```env
PORT=8001  # 改为其他端口，如 8002
```

### 主项目配置

在 `backend/.env` 中（如果需要）：
```env
API_PROXY_URL=http://localhost:8001
```

**注意：** 不需要在环境变量中包含 `/open-api`，代码中已经自动添加。

## ✨ 新增功能

### API 信息端点

访问根路径查看 API 信息：
```bash
curl http://localhost:8001/open-api/
```

**响应：**
```json
{
  "service": "API Proxy Service",
  "status": "running",
  "version": "1.0.0",
  "base_path": "/open-api",
  "endpoints": {
    "asr_create": "/open-api/asr/create",
    "asr_get": "/open-api/asr/get",
    "llm_chat": "/open-api/llm/chat",
    "file_upload": "/open-api/upload"
  }
}
```

## 🔍 故障排查

### 问题：连接被拒绝

```bash
curl: (7) Failed to connect to localhost port 8001: Connection refused
```

**解决方法：**
1. 确认 API Proxy 服务已启动：`cd api-proxy && python main.py`
2. 检查端口是否正确（默认 8001）
3. 检查防火墙设置

### 问题：404 Not Found

```bash
{"detail":"Not Found"}
```

**解决方法：**
- 确保使用了 `/open-api` 前缀
- 旧路径：`/health` ❌
- 新路径：`/open-api/health` ✅
- 旧路径：`/test` ❌
- 新路径：`/open-api/test` ✅

### 问题：主项目无法调用 API Proxy

**解决方法：**
1. 检查 `backend/.env` 中的 `API_PROXY_URL` 配置
2. 确认 API Proxy 服务正在运行
3. 查看后端启动日志中的转发服务地址

## 📚 更多文档

- `API_ROUTES.md` - 详细的路由说明
- `README.md` - 完整的部署和配置文档
- `env.example` - 环境变量配置示例

## 🎯 下一步

1. ✅ 测试所有接口是否正常工作
2. ✅ 确认主项目可以正常调用 API Proxy
3. 📝 根据需要调整端口配置
4. 🚀 部署到生产环境时，更新 `API_PROXY_URL` 为实际地址

