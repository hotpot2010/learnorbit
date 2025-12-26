# Better Auth 迁移到 Backend API

## 📋 概述

将 Better Auth 的数据库访问从直接访问数据库迁移到通过 Backend API 访问。这样可以让认证系统也通过统一的 Backend API 访问数据库，符合架构要求。

## ✅ 已完成的工作

### 1. Backend API 认证数据库端点

**文件位置**：`backend/app/api/routes/auth_db.py`

**功能**：
- ✅ User CRUD 操作（创建、查询、更新、删除）
- ✅ Session CRUD 操作（创建、查询、更新、删除）
- ✅ Account CRUD 操作（创建、查询、更新、删除）
- ✅ Verification CRUD 操作（创建、查询、删除）

**API 端点**：
- `/api/auth-db/user` - 用户操作
- `/api/auth-db/session` - 会话操作
- `/api/auth-db/account` - 账户操作
- `/api/auth-db/verification` - 验证操作

### 2. 前端 API 客户端

**文件位置**：`src/lib/auth-adapter-api.ts`

**功能**：
- 封装所有 Backend API 调用
- 提供类型安全的 API 方法
- 处理错误和响应转换

### 3. Better Auth 自定义适配器

**文件位置**：`src/lib/auth-adapter.ts`

**功能**：
- 实现 Better Auth 的 `Adapter` 接口
- 将所有数据库操作转换为 Backend API 调用
- 处理字段名映射（snake_case ↔ camelCase）
- 处理日期时间转换

### 4. 更新认证配置

**文件位置**：`src/lib/auth.ts`

**变更**：
- 移除直接数据库连接
- 使用自定义适配器 `createBackendAPIAdapter()`
- 移除未使用的 `drizzleAdapter` 导入

## 🔧 架构说明

### 之前（直接访问数据库）

```
Better Auth → Drizzle ORM → PostgreSQL/MySQL
```

### 现在（通过 Backend API）

```
Better Auth → 自定义适配器 → Backend API → MySQL
```

## 📊 数据流

1. **用户操作**（登录、注册等）
   - Better Auth 调用适配器方法
   - 适配器调用 `auth-adapter-api.ts`
   - API 客户端发送 HTTP 请求到 Backend API
   - Backend API 访问 MySQL 数据库
   - 响应返回给 Better Auth

2. **会话管理**
   - Better Auth 创建/更新/删除会话
   - 通过适配器调用 Backend API
   - Backend API 操作 `learnorbit_session` 表

3. **账户管理**
   - Better Auth 管理第三方账户（Google 等）
   - 通过适配器调用 Backend API
   - Backend API 操作 `learnorbit_account` 表

## 🔑 关键实现细节

### 字段名映射

Better Auth 使用 camelCase，Backend API 使用 snake_case：

```typescript
// Better Auth 格式
{
  emailVerified: true,
  customerId: "xxx"
}

// Backend API 格式
{
  email_verified: true,
  customer_id: "xxx"
}
```

### 日期时间处理

```typescript
// 发送到 Backend API
expires_at: data.expiresAt.toISOString()

// 从 Backend API 接收
expiresAt: new Date(account.expires_at)
```

### 错误处理

- 404 错误返回 `null`（表示未找到）
- 其他错误抛出异常
- 适配器会正确处理这些情况

## 🚀 使用方法

### 环境变量

确保设置了 Backend API URL：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 启动服务

1. **启动 Backend API**：
```bash
cd backend
python -m uvicorn main:app --reload
```

2. **启动前端**：
```bash
npm run dev
```

### 测试认证功能

1. 用户注册
2. 用户登录
3. Google OAuth 登录
4. 会话管理
5. 用户信息更新

## 📝 注意事项

1. **性能考虑**：
   - 每次数据库操作都需要 HTTP 请求
   - 考虑添加缓存机制（如果需要）
   - Backend API 已经有连接池优化

2. **错误处理**：
   - 网络错误会被抛出
   - 需要在前端处理这些错误
   - Better Auth 会自动处理大部分错误

3. **类型安全**：
   - 适配器使用 TypeScript 类型
   - Backend API 响应需要匹配 Better Auth 的类型定义

## 🔍 调试

### 查看日志

Backend API 日志：
```bash
# 查看 Backend API 请求日志
tail -f backend/logs/app.log
```

前端日志：
```bash
# 浏览器控制台查看认证相关日志
# 查找 "✅ Using Backend API adapter for authentication"
```

### 测试 API 端点

```bash
# 测试用户查询
curl http://localhost:8000/api/auth-db/user?email=test@example.com

# 测试会话查询
curl http://localhost:8000/api/auth-db/session?token=xxx
```

## ✅ 迁移完成检查清单

- [x] Backend API 认证端点已创建
- [x] 前端 API 客户端已创建
- [x] Better Auth 自定义适配器已创建
- [x] auth.ts 已更新使用自定义适配器
- [x] 未使用的导入已移除
- [ ] 测试用户注册功能
- [ ] 测试用户登录功能
- [ ] 测试 Google OAuth 登录
- [ ] 测试会话管理
- [ ] 测试用户信息更新

## 🎯 下一步

1. 测试所有认证功能
2. 监控性能指标
3. 根据需要优化缓存策略
4. 更新文档和注释

