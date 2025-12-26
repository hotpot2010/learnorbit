# 数据库操作迁移到 Backend API 文档

## 🎯 迁移目标

将前端 Next.js API Routes 中的 Supabase 数据库直接调用改为调用 Backend API，因为公司 MySQL 数据库不支持外网直接访问。

---

## ✅ 已完成的迁移

### 1. Backend API 端点

#### ✅ 课程管理 API (`backend/app/api/routes/courses.py`)
- `POST /api/user-courses/` - 创建课程
- `GET /api/user-courses/user/{user_id}` - 获取用户课程
- `GET /api/user-courses/{course_id}` - 获取单个课程
- `PATCH /api/user-courses/{course_id}` - 更新课程
- `DELETE /api/user-courses/{course_id}` - 删除课程

#### ✅ 视频笔记 API (`backend/app/api/routes/video_notes.py`)
- `POST /api/video-notes/` - 创建或更新笔记
- `GET /api/video-notes/` - 获取用户笔记（支持分页和 taskId 过滤）
- `GET /api/video-notes/{note_id}` - 获取单个笔记
- `PATCH /api/video-notes/{note_id}` - 更新笔记
- `DELETE /api/video-notes/{note_id}` - 删除笔记

#### ✅ 分析统计 API (`backend/app/api/routes/analytics.py`)
- `POST /api/analytics/key-actions` - 记录关键行为
- `GET /api/analytics/stats` - 获取统计数据

### 2. 前端 API Routes 修改

#### ✅ 已迁移的文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/app/api/user-courses/route.ts` | ✅ 已迁移 | POST/GET 改为调用 Backend API |
| `src/app/api/video-notes/route.ts` | ✅ 已迁移 | POST/GET 改为调用 Backend API |
| `src/app/api/analytics/key-actions/route.ts` | ✅ 已迁移 | POST 改为调用 Backend API |

#### ✅ 新增文件

- `src/lib/backend-api.ts` - Backend API 客户端封装

### 3. Backend 路由注册

在 `backend/main.py` 中已注册：
```python
from app.api.routes import courses, video_notes, analytics
app.include_router(courses.router, tags=["courses"])
app.include_router(video_notes.router, tags=["video-notes"])
app.include_router(analytics.router, tags=["analytics"])
```

---

## 📋 还需要迁移的文件

### 待迁移的 API Routes

以下文件仍在使用直接数据库连接，需要迁移：

1. **课程相关**
   - `src/app/api/user-courses/[courseId]/route.ts` - 单个课程操作
   - `src/app/api/user-courses/[courseId]/progress/route.ts` - 进度更新
   - `src/app/api/user-courses/[courseId]/tasks/route.ts` - 任务管理
   - `src/app/api/user-courses/[courseId]/tasks/generate/route.ts` - 任务生成

2. **视频笔记相关**
   - `src/app/api/video-notes/[noteId]/route.ts` - 单个笔记操作

3. **公开课程相关**
   - `src/app/api/public-courses/route.ts` - 公开课程列表
   - `src/app/api/public-courses/[slug]/route.ts` - 通过 slug 访问
   - `src/app/api/creator-courses/route.ts` - 创作者课程管理
   - `src/app/api/creator-courses/[slug]/route.ts` - 创作者课程访问

4. **分析统计相关**
   - `src/app/api/analytics/stats/route.ts` - 统计数据

---

## 🔧 迁移步骤

### 步骤 1：完善 Backend API

为待迁移的 API Routes 创建对应的 Backend API 端点。

### 步骤 2：修改前端 API Routes

将数据库调用改为 Backend API 调用：

**修改前**：
```typescript
import { getDb } from '@/db';
import { userCourses } from '@/db/schema';

const db = await getDb();
const courses = await db.select().from(userCourses).where(...);
```

**修改后**：
```typescript
import backendAPI from '@/lib/backend-api';

const courses = await backendAPI.courses.getUserCourses(userId);
```

### 步骤 3：更新环境变量

确保 `.env` 中配置了 Backend API 地址：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
# 或生产环境
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 步骤 4：测试

1. 启动 Backend API
   ```bash
   cd backend
   python main.py
   ```

2. 启动前端
   ```bash
   npm run dev
   ```

3. 测试功能
   - 用户登录/注册
   - 创建课程
   - 保存视频笔记
   - 查看统计数据

---

## 🏗️ 架构变化

### 迁移前

```
Next.js API Route
    ↓ 直接连接
Supabase (PostgreSQL)
```

### 迁移后

```
Next.js API Route
    ↓ HTTP 调用
Backend API (FastAPI)
    ↓ SQLAlchemy
MySQL (公司数据库)
```

---

## 📝 注意事项

### 1. 认证处理

Backend API 需要从请求中获取用户信息。当前实现使用 `user_id` 作为查询参数，建议改为：

- 使用 JWT Token 认证
- 从请求头中获取用户信息

### 2. 错误处理

确保 Backend API 返回的错误格式与前端期望一致：

```json
{
  "detail": "错误信息"
}
```

### 3. CORS 配置

确保 Backend 的 CORS 配置允许前端域名访问：

```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. 数据格式

确保 Backend API 返回的数据格式与前端期望一致，特别是：
- 日期时间格式
- JSON 字段结构
- 分页响应格式

---

## ✅ 验证清单

迁移完成后，请确认：

- [ ] Backend API 正常运行
- [ ] 前端可以成功调用 Backend API
- [ ] 用户认证正常工作
- [ ] 课程 CRUD 功能正常
- [ ] 视频笔记 CRUD 功能正常
- [ ] 行为分析记录正常
- [ ] 错误处理正确
- [ ] CORS 配置正确
- [ ] 生产环境部署测试通过

---

## 🚀 下一步

1. **完成剩余 API Routes 的迁移**
2. **添加认证中间件**（JWT Token）
3. **添加 API 文档**（Swagger/OpenAPI）
4. **性能优化**（缓存、连接池等）
5. **监控和日志**

---

*创建日期：2024-12-25*  
*最后更新：2024-12-25*

