# API Proxy 路由说明

## 📍 路径前缀

所有 API 接口都使用统一的路径前缀：`/open-api`

## 🌐 完整接口列表

### 1. API 信息和测试

| 路径 | 方法 | 说明 |
|------|------|------|
| `/open-api/` | GET | API 信息和端点列表 |
| `/open-api/health` | GET | 健康检查 |
| `/open-api/test` | GET | 测试页面（HTML） |

### 2. ASR 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/open-api/asr/create` | POST | 创建 ASR 任务 |
| `/open-api/asr/get` | GET | 查询 ASR 任务结果 |

### 3. LLM 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/open-api/llm/chat` | POST | LLM 对话 |

### 4. 文件上传接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/open-api/upload` | POST | 文件上传 |

## 🧪 快速测试命令

### 健康检查
```bash
curl http://localhost:8001/open-api/health
```

### ASR 创建
```bash
curl -X POST http://localhost:8001/open-api/asr/create \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/test.mp3","callbackUrl":"https://example.com/cb"}'
```

### ASR 查询
```bash
curl "http://localhost:8001/open-api/asr/get?id=test-task-123"
```

### LLM 对话
```bash
curl -X POST http://localhost:8001/open-api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-4.5-sonnet","messages":[{"role":"user","content":"Hello"}],"max_tokens":50}'
```

### 文件上传
```bash
curl -X POST http://localhost:8001/open-api/upload \
  -F "file=@test.txt" \
  -F "uid=20210716"
```

## 🔄 路径变更对比

| 旧路径 | 新路径 |
|--------|--------|
| `/health` | `/open-api/health` |
| `/asr/create` | `/open-api/asr/create` |
| `/asr/get` | `/open-api/asr/get` |
| `/llm/chat` | `/open-api/llm/chat` |
| `/upload` | `/open-api/upload` |

## ⚙️ 主项目配置修改

如果您的主项目（backend）调用了 API Proxy，需要更新以下配置：

### backend/.env
```env
# 旧配置
API_PROXY_URL=http://localhost:8001

# 保持不变，接口路径在代码中调整
API_PROXY_URL=http://localhost:8001
```

### 代码中的调用示例

**旧代码：**
```python
url = f"{self.base_url}/asr/create"
```

**新代码：**
```python
url = f"{self.base_url}/open-api/asr/create"
```

或者更新 `base_url` 配置：
```python
# 在 __init__ 中
self.base_url = f"{proxy_base_url}/open-api"
# 然后调用时
url = f"{self.base_url}/asr/create"
```

## 📊 启动信息

启动服务后，会显示：

```
============================================================
🚀 API Proxy Service Started
============================================================
📍 Base Path: /open-api
📍 ASR Service: https://tech.baijia.com/ai/tool/asr/async
📍 LLM Service: https://llm.baijia.com/v1/chat/completions
📍 File Upload: http://internal-storage.genshuixue.com/webupload.php
============================================================
```

## 🎯 访问测试页面

浏览器打开：http://localhost:8001/

测试页面已自动更新为使用 `/open-api` 前缀。

