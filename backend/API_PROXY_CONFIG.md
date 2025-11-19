# API Proxy 配置说明

## 📋 概述

主项目后端通过 `API_PROXY_URL` 环境变量配置 API 转发服务的地址。

## ⚙️ 配置方法

### 1. 环境变量配置

在 `backend/.env` 文件中配置：

```env
# API 转发服务地址（不包含 /open-api 路径）
API_PROXY_URL=http://localhost:8001
```

### 2. 不同环境配置

#### 🏠 本地开发环境

```env
# backend/.env
API_PROXY_URL=http://localhost:8001
```

**使用场景：**
- 本地开发和调试
- API Proxy 服务在本地运行

**完整 URL 示例：**
- 健康检查：`http://localhost:8001/open-api/health`
- ASR 创建：`http://localhost:8001/open-api/asr/create`
- LLM 对话：`http://localhost:8001/open-api/llm/chat`

#### ☁️ 线上生产环境

```env
# backend/.env
API_PROXY_URL=https://learnorbit.gaotu.cn
```

**使用场景：**
- 生产环境部署
- API Proxy 服务部署在云端

**完整 URL 示例：**
- 健康检查：`https://learnorbit.gaotu.cn/open-api/health`
- ASR 创建：`https://learnorbit.gaotu.cn/open-api/asr/create`
- LLM 对话：`https://learnorbit.gaotu.cn/open-api/llm/chat`

**验证配置：**
访问 https://learnorbit.gaotu.cn/open-api 查看 API 信息

#### 🧪 测试环境

```env
# backend/.env
API_PROXY_URL=https://test-api.yourdomain.com
```

## 🔍 配置验证

### 1. 检查环境变量是否生效

启动后端服务时，查看日志：

```bash
cd backend
python main.py
```

**日志输出示例：**
```
📤 File upload service initialized
📍 Upload URL: https://learnorbit.gaotu.cn/open-api/upload

🤖 Doubao Service initialized
📍 Using Baijia LLM API: https://learnorbit.gaotu.cn/open-api/llm/chat
```

### 2. 测试 API Proxy 连通性

**本地环境：**
```bash
curl http://localhost:8001/open-api/health
```

**线上环境：**
```bash
curl https://learnorbit.gaotu.cn/open-api/health
```

**预期响应：**
```json
{
  "status": "ok",
  "message": "API Proxy Service is running"
}
```

## 📊 服务使用情况

### 使用 API_PROXY_URL 的服务

主项目中以下服务会使用 `API_PROXY_URL` 配置：

| 服务 | 文件 | 接口路径 |
|------|------|----------|
| ASR 服务 | `app/services/asr_service.py` | `/open-api/asr/create`<br>`/open-api/asr/get` |
| LLM 服务 | `app/services/doubao_service.py` | `/open-api/llm/chat` |
| 文件上传 | `app/services/file_upload_service.py` | `/open-api/upload` |

### 代码示例

```python
# backend/app/services/asr_service.py
PROXY_BASE_URL = os.getenv("API_PROXY_URL", "http://localhost:8001")
ASR_CREATE_URL = f"{PROXY_BASE_URL}/open-api/asr/create"
ASR_GET_URL = f"{PROXY_BASE_URL}/open-api/asr/get"

# backend/app/services/doubao_service.py
proxy_base_url = os.getenv('API_PROXY_URL', 'http://localhost:8001')
self.base_url = f"{proxy_base_url}/open-api/llm/chat"

# backend/app/services/file_upload_service.py
proxy_base_url = os.getenv('API_PROXY_URL', 'http://localhost:8001')
self.upload_url = f"{proxy_base_url}/open-api/upload"
```

## 🚀 快速切换环境

### 方法 1：修改 .env 文件

```bash
# 切换到本地
echo "API_PROXY_URL=http://localhost:8001" > backend/.env

# 切换到线上
echo "API_PROXY_URL=https://learnorbit.gaotu.cn" > backend/.env
```

### 方法 2：使用环境变量

**Windows PowerShell：**
```powershell
# 本地
$env:API_PROXY_URL="http://localhost:8001"; python main.py

# 线上
$env:API_PROXY_URL="https://learnorbit.gaotu.cn"; python main.py
```

**Linux/Mac：**
```bash
# 本地
API_PROXY_URL=http://localhost:8001 python main.py

# 线上
API_PROXY_URL=https://learnorbit.gaotu.cn python main.py
```

### 方法 3：创建不同的 .env 文件

```bash
# 创建不同环境的配置文件
backend/
  ├── .env.local      # 本地开发配置
  ├── .env.production # 生产环境配置
  └── .env.test       # 测试环境配置
```

**使用时复制对应文件：**
```bash
# 切换到本地环境
cp backend/.env.local backend/.env

# 切换到生产环境
cp backend/.env.production backend/.env
```

## 🔧 故障排查

### 问题 1：连接超时

**错误信息：**
```
ConnectionError: HTTPConnectionPool(host='localhost', port=8001)
```

**解决方法：**
1. 检查 `API_PROXY_URL` 配置是否正确
2. 确认 API Proxy 服务是否运行
3. 检查网络连接和防火墙设置

### 问题 2：404 Not Found

**错误信息：**
```
{"detail":"Not Found"}
```

**解决方法：**
1. 确认 API Proxy 服务版本是否支持 `/open-api` 前缀
2. 检查路径拼接是否正确
3. 访问 `{API_PROXY_URL}/open-api/` 查看可用端点

### 问题 3：CORS 错误

**错误信息：**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**解决方法：**
1. 确认 API Proxy 服务的 CORS 配置
2. 检查请求来源是否在白名单中
3. 如果是生产环境，可能需要配置 Nginx 反向代理

## 📝 配置检查清单

部署前请确认：

- [ ] `backend/.env` 文件中配置了正确的 `API_PROXY_URL`
- [ ] API Proxy 服务在目标地址上正常运行
- [ ] 网络连通性正常（可以 curl 测试）
- [ ] 所有依赖的服务（ASR、LLM、文件上传）都可用
- [ ] 日志中显示的 URL 地址正确

## 🌐 在线 API 信息

当前线上 API Proxy 信息：https://learnorbit.gaotu.cn/open-api

```json
{
  "service": "API Proxy Service",
  "status": "running",
  "version": "1.0.0",
  "base_path": "/open-api",
  "endpoints": {
    "health": "/open-api/health",
    "test": "/open-api/test",
    "asr_create": "/open-api/asr/create",
    "asr_get": "/open-api/asr/get",
    "llm_chat": "/open-api/llm/chat",
    "file_upload": "/open-api/upload"
  }
}
```

## 💡 最佳实践

1. **使用环境变量**：不要在代码中硬编码 URL
2. **配置验证**：启动时检查配置是否正确
3. **日志记录**：记录实际使用的 URL 便于调试
4. **健康检查**：定期检查 API Proxy 服务状态
5. **错误处理**：处理网络请求失败的情况


