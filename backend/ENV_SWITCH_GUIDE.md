# 环境配置切换指南

## 🎯 目标

快速在本地开发环境和线上生产环境之间切换 API Proxy 配置。

## 📁 配置文件说明

| 文件 | 用途 | API_PROXY_URL |
|------|------|---------------|
| `env.example` | 配置模板 | `http://localhost:8001` |
| `env.local.example` | 本地开发环境 | `http://localhost:8001` |
| `env.production.example` | 线上生产环境 | `https://learnorbit.gaotu.cn` |
| `.env` | 实际使用的配置 | 取决于当前环境 |

## 🚀 快速切换方法

### 方法 1：使用切换脚本（推荐）

#### Windows
```cmd
cd backend
switch_env.bat
```

#### Linux/Mac
```bash
cd backend
chmod +x switch_env.sh
./switch_env.sh
```

**交互式菜单：**
```
==========================================
🔄 环境配置切换工具
==========================================

请选择环境：
1. 本地开发环境 (localhost:8001)
2. 线上生产环境 (https://learnorbit.gaotu.cn)
3. 查看当前配置
0. 退出

请输入选项 (0-3):
```

### 方法 2：手动复制文件

#### 切换到本地开发环境
```bash
cd backend
cp env.local.example .env
```

#### 切换到线上生产环境
```bash
cd backend
cp env.production.example .env
```

### 方法 3：直接修改 .env 文件

编辑 `backend/.env`，修改以下行：

**本地开发：**
```env
API_PROXY_URL=http://localhost:8001
```

**线上生产：**
```env
API_PROXY_URL=https://learnorbit.gaotu.cn
```

## ✅ 验证配置

### 1. 查看当前配置

**Windows:**
```cmd
cd backend
findstr "API_PROXY_URL" .env
```

**Linux/Mac:**
```bash
cd backend
grep "API_PROXY_URL" .env
```

### 2. 启动服务验证

```bash
cd backend
python main.py
```

**查看启动日志：**
```
📤 File upload service initialized
📍 Upload URL: https://learnorbit.gaotu.cn/open-api/upload

🤖 Doubao Service initialized
📍 Using Baijia LLM API: https://learnorbit.gaotu.cn/open-api/llm/chat
```

### 3. 测试连通性

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

## 📊 环境对比

| 项目 | 本地开发 | 线上生产 |
|------|----------|----------|
| API_PROXY_URL | `http://localhost:8001` | `https://learnorbit.gaotu.cn` |
| DEBUG | `true` | `false` |
| CORS_ORIGINS | `localhost:3000` | `aitutorly.ai` |
| 日志级别 | 详细 | 精简 |

## 🔄 典型工作流程

### 本地开发
```bash
# 1. 切换到本地环境
cd backend
switch_env.bat  # 选择 1

# 2. 启动本地 API Proxy
cd ../api-proxy
python main.py  # 运行在 localhost:8001

# 3. 启动后端服务
cd ../backend
python main.py

# 4. 开发和测试...
```

### 部署到生产
```bash
# 1. 切换到生产环境配置
cd backend
switch_env.bat  # 选择 2

# 2. 验证配置
grep "API_PROXY_URL" .env
# 输出: API_PROXY_URL=https://learnorbit.gaotu.cn

# 3. 测试线上 API Proxy
curl https://learnorbit.gaotu.cn/open-api/health

# 4. 部署后端服务
python main.py

# 5. 验证服务
curl http://localhost:8000/health
```

## 🛠️ 故障排查

### 问题 1：切换后仍使用旧配置

**原因：** 代码缓存或未重启服务

**解决：**
```bash
# 1. 停止所有服务 (Ctrl+C)
# 2. 验证配置文件
cat .env | grep API_PROXY_URL
# 3. 重新启动服务
python main.py
```

### 问题 2：本地环境连接失败

**错误：** `Connection refused to localhost:8001`

**解决：**
```bash
# 1. 检查 API Proxy 是否运行
cd api-proxy
python main.py

# 2. 检查端口是否被占用
netstat -ano | findstr :8001  # Windows
lsof -i :8001                 # Linux/Mac
```

### 问题 3：线上环境 404 错误

**错误：** `{"detail":"Not Found"}`

**解决：**
```bash
# 1. 检查线上服务是否运行
curl https://learnorbit.gaotu.cn/open-api/

# 2. 验证配置
grep "API_PROXY_URL" backend/.env

# 3. 检查网络连接
ping learnorbit.gaotu.cn
```

## 💡 最佳实践

1. **开发时使用本地环境**
   - 快速调试
   - 不依赖网络
   - 可以查看详细日志

2. **测试前切换到线上环境**
   - 验证集成
   - 测试真实网络状况
   - 确认生产配置

3. **部署前再次检查配置**
   - 使用切换脚本查看当前配置（选项 3）
   - 确认 DEBUG=false
   - 验证 CORS 配置

4. **保持配置文件同步**
   - 新增配置项同时更新所有 example 文件
   - 提交代码前检查 .env 文件是否在 .gitignore 中

## 📚 相关文档

- `API_PROXY_CONFIG.md` - 详细的配置说明
- `env.example` - 配置模板
- `env.local.example` - 本地环境配置
- `env.production.example` - 生产环境配置

## 🔗 相关链接

- 本地 API Proxy: http://localhost:8001/open-api/
- 线上 API Proxy: https://learnorbit.gaotu.cn/open-api/
- 测试页面（本地）: http://localhost:8001/open-api/test
- 测试页面（线上）: https://learnorbit.gaotu.cn/open-api/test


