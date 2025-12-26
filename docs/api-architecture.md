# 🏗️ API 架构设计文档

## 📋 目录

- [架构概述](#架构概述)
- [为什么选择 API 架构](#为什么选择-api-架构)
- [实现方案](#实现方案)
- [API 接口文档](#api-接口文档)
- [前端集成](#前端集成)
- [迁移步骤](#迁移步骤)

---

## 🎯 架构概述

### 当前架构（直连数据库）

```
┌─────────────────────┐
│   Next.js Frontend  │
│   (Vercel Deploy)   │
└──────────┬──────────┘
           │
           │ 直接连接数据库
           │ (Drizzle ORM)
           ▼
    ┌──────────────┐
    │    MySQL     │
    │ (公司数据库)  │
    └──────────────┘
```

**问题**：
- ❌ 前端需要数据库连接池
- ❌ 数据库凭证暴露在前端
- ❌ Serverless 环境连接管理复杂
- ❌ 前端包体积大（包含 ORM）

### 推荐架构（API 统一访问）

```
┌─────────────────────┐
│   Next.js Frontend  │
│    (静态部署)        │
└──────────┬──────────┘
           │
           │ HTTP/REST API
           │ (只调用 API)
           ▼
┌─────────────────────┐
│  FastAPI Backend    │
│   (统一数据访问)     │
└──────────┬──────────┘
           │
           │ 数据库连接池
           │ (SQLAlchemy)
           ▼
    ┌──────────────┐
    │    MySQL     │
    │ (公司数据库)  │
    │  (所有数据)   │
    └──────────────┘
```

**优势**：
- ✅ 前端不需要数据库连接
- ✅ 数据库凭证只在后端
- ✅ 统一的权限控制
- ✅ 更好的性能和缓存

---

## 💡 为什么选择 API 架构

### 1. 安全性

**直连数据库**：
```typescript
// ❌ 数据库凭证暴露在前端环境变量
DATABASE_URL="mysql://user:password@host:3306/db"

// ❌ 前端可以执行任何 SQL 查询
const users = await db.select().from(user).where(eq(user.email, email));
```

**API 架构**：
```typescript
// ✅ 前端只知道 API 地址
const API_URL = "https://api.example.com"

// ✅ 后端控制数据访问权限
const users = await fetch(`${API_URL}/api/users?email=${email}`);
```

### 2. 部署简化

**直连数据库**：
- 需要 Serverless 数据库连接支持
- 需要配置连接池（每个实例 1 个连接）
- 冷启动时需要建立数据库连接

**API 架构**：
- 前端可以部署到纯静态 CDN
- 后端统一管理连接池
- 前端无需关心数据库连接

### 3. 性能优化

**直连数据库**：
```typescript
// ❌ 每个 Serverless 实例都需要连接
// 20 个实例 = 20 个数据库连接
```

**API 架构**：
```typescript
// ✅ 后端统一连接池
// 100 个前端请求 → 后端 5 个连接池连接
// 可以做数据缓存、请求合并等优化
```

### 4. 开发体验

**直连数据库**：
- 前端需要理解 ORM
- 需要同步数据库 Schema
- 需要处理数据库连接错误

**API 架构**：
- 前端只需要调用 REST API
- 类型安全的 API 客户端
- 统一的错误处理

---

## 🔧 实现方案

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **完全迁移** | 架构清晰、安全性最好 | 需要开发所有 API | ⭐⭐⭐⭐⭐ |
| **混合模式** | 渐进式迁移、风险小 | 架构复杂、维护困难 | ⭐⭐⭐ |
| **保持现状** | 不需要改动 | 安全性差、部署复杂 | ⭐ |

### 推荐：完全迁移到 API 架构

---

## 📡 API 接口文档

### 认证 API

#### POST /api/auth/register
注册新用户

**请求**：
```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "password123"
}
```

**响应**：
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_at": "2024-12-31T23:59:59",
  "user": {
    "id": "user_123",
    "name": "张三",
    "email": "zhangsan@example.com",
    "email_verified": false,
    "created_at": "2024-12-25T10:00:00"
  }
}
```

#### POST /api/auth/login
用户登录

#### GET /api/auth/session/{token}
获取当前会话

#### DELETE /api/auth/logout
用户登出

---

### 课程 API

#### POST /api/courses/
创建新课程

**请求**：
```json
{
  "user_id": "user_123",
  "course_plan": {
    "plan": [...],
    "tasks": {...}
  },
  "plan_url": "https://cdn.example.com/plan.json"
}
```

#### GET /api/courses/user/{user_id}
获取用户的所有课程

#### GET /api/courses/{course_id}
获取单个课程详情

#### PATCH /api/courses/{course_id}
更新课程

**请求**：
```json
{
  "current_step": 5,
  "status": "in-progress"
}
```

#### DELETE /api/courses/{course_id}
删除课程

---

## 🚀 前端集成

### 1. 安装 API 客户端

```typescript
// src/lib/api-client.ts 已创建

import apiClient from '@/lib/api-client';
```

### 2. 使用示例

#### 用户认证

```typescript
// 注册
const session = await apiClient.auth.register('张三', 'zhangsan@example.com', 'password123');
console.log('Token:', session.token);

// 登录
const session = await apiClient.auth.login('zhangsan@example.com', 'password123');

// 获取当前用户
const user = await apiClient.auth.getSession();
console.log('User:', user.name);

// 登出
await apiClient.auth.logout();
```

#### 课程管理

```typescript
// 创建课程
const course = await apiClient.courses.create(userId, coursePlan);

// 获取用户课程
const courses = await apiClient.courses.getUserCourses(userId);

// 更新课程进度
await apiClient.courses.update(courseId, {
  current_step: 5,
  status: 'in-progress'
});

// 删除课程
await apiClient.courses.delete(courseId);
```

#### React 组件中使用

```typescript
'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';

export function CourseList({ userId }: { userId: string }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCourses() {
      try {
        const data = await apiClient.courses.getUserCourses(userId);
        setCourses(data);
      } catch (error) {
        console.error('加载课程失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, [userId]);

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      {courses.map(course => (
        <div key={course.id}>{course.course_plan.plan.title}</div>
      ))}
    </div>
  );
}
```

---

## 📋 迁移步骤

### 阶段 1：准备后端 API

1. **安装依赖**
   ```bash
   cd backend
   pip install bcrypt python-jose[cryptography]
   ```

2. **注册 API 路由**
   ```python
   # backend/main.py
   from app.api.routes import auth, courses
   
   app.include_router(auth.router)
   app.include_router(courses.router)
   ```

3. **测试 API**
   ```bash
   # 启动后端
   cd backend
   python main.py
   
   # 测试 API
   curl http://localhost:8000/api/auth/register \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com","password":"password"}'
   ```

### 阶段 2：前端集成

1. **配置 API 地址**
   ```bash
   # .env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

2. **使用 API 客户端**
   ```typescript
   // 替换原来的数据库调用
   // ❌ 旧代码
   const courses = await db.select().from(userCourses).where(eq(userCourses.userId, userId));
   
   // ✅ 新代码
   const courses = await apiClient.courses.getUserCourses(userId);
   ```

3. **移除前端数据库依赖**
   ```bash
   # 可以移除的依赖（可选）
   npm uninstall drizzle-orm postgres mysql2
   ```

### 阶段 3：部署

1. **部署后端**
   - 确保后端可以访问 MySQL
   - 配置 CORS 允许前端域名

2. **更新前端环境变量**
   ```bash
   # 生产环境
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

3. **部署前端**
   - 可以部署到任何静态托管服务
   - Vercel、Netlify、Cloudflare Pages 等

---

## ✅ 验证清单

迁移完成后，请确认：

- [ ] 后端 API 正常运行
- [ ] 用户注册/登录功能正常
- [ ] 课程 CRUD 功能正常
- [ ] 前端不再直接连接数据库
- [ ] API 有适当的错误处理
- [ ] 有权限控制（token 验证）
- [ ] CORS 配置正确
- [ ] 生产环境部署测试通过

---

## 📚 参考资料

- FastAPI 文档: https://fastapi.tiangolo.com/
- SQLAlchemy 文档: https://docs.sqlalchemy.org/
- REST API 设计最佳实践
- JWT 认证指南

---

*最后更新：2024-12-25*


