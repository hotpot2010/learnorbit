# 📊 数据库操作迁移状态

## ✅ 已完成迁移

### Backend API 端点

1. **课程管理 API** (`backend/app/api/routes/courses.py`)
   - ✅ POST /api/user-courses/ - 创建课程
   - ✅ GET /api/user-courses/user/{user_id} - 获取用户课程
   - ✅ GET /api/user-courses/{course_id} - 获取单个课程
   - ✅ PATCH /api/user-courses/{course_id} - 更新课程
   - ✅ DELETE /api/user-courses/{course_id} - 删除课程

2. **视频笔记 API** (`backend/app/api/routes/video_notes.py`)
   - ✅ POST /api/video-notes/ - 创建或更新笔记
   - ✅ GET /api/video-notes/ - 获取用户笔记（支持分页和 taskId 过滤）
   - ✅ GET /api/video-notes/{note_id} - 获取单个笔记
   - ✅ PATCH /api/video-notes/{note_id} - 更新笔记
   - ✅ DELETE /api/video-notes/{note_id} - 删除笔记

3. **分析统计 API** (`backend/app/api/routes/analytics.py`)
   - ✅ POST /api/analytics/key-actions - 记录关键行为
   - ✅ GET /api/analytics/stats - 获取统计数据

### 前端 API Routes 迁移

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/app/api/user-courses/route.ts` | ✅ 已迁移 | POST/GET 改为调用 Backend API |
| `src/app/api/video-notes/route.ts` | ✅ 已迁移 | POST/GET 改为调用 Backend API |
| `src/app/api/analytics/key-actions/route.ts` | ✅ 已迁移 | POST 改为调用 Backend API |

### 新增文件

- ✅ `src/lib/backend-api.ts` - Backend API 客户端封装
- ✅ `backend/app/api/routes/courses.py` - 课程管理 API
- ✅ `backend/app/api/routes/video_notes.py` - 视频笔记 API
- ✅ `backend/app/api/routes/analytics.py` - 分析统计 API

---

## ⏳ 待迁移的文件

以下文件仍在使用直接数据库连接（`getDb()`），需要迁移到 Backend API：

### 课程相关

- [ ] `src/app/api/user-courses/[courseId]/route.ts` - 单个课程操作
- [ ] `src/app/api/user-courses/[courseId]/progress/route.ts` - 进度更新
- [ ] `src/app/api/user-courses/[courseId]/tasks/route.ts` - 任务管理
- [ ] `src/app/api/user-courses/[courseId]/tasks/generate/route.ts` - 任务生成

### 视频笔记相关

- [ ] `src/app/api/video-notes/[noteId]/route.ts` - 单个笔记操作

### 公开课程相关

- [ ] `src/app/api/public-courses/route.ts` - 公开课程列表
- [ ] `src/app/api/public-courses/[slug]/route.ts` - 通过 slug 访问
- [ ] `src/app/api/creator-courses/route.ts` - 创作者课程管理
- [ ] `src/app/api/creator-courses/[slug]/route.ts` - 创作者课程访问

### 分析统计相关

- [ ] `src/app/api/analytics/stats/route.ts` - 统计数据

---

## 🚀 快速开始

### 1. 启动 Backend API

```bash
cd backend
python main.py
```

应该看到：
```
✅ 前端数据库操作 API 已启用 (/api/user-courses, /api/video-notes, /api/analytics)
```

### 2. 配置前端环境变量

```bash
# .env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 启动前端

```bash
npm run dev
```

### 4. 测试功能

- ✅ 创建课程
- ✅ 获取用户课程
- ✅ 保存视频笔记
- ✅ 记录行为分析

---

## 📝 迁移模式

### 修改前（直接数据库）

```typescript
import { getDb } from '@/db';
import { userCourses } from '@/db/schema';

const db = await getDb();
const courses = await db.select().from(userCourses).where(...);
```

### 修改后（Backend API）

```typescript
import backendAPI from '@/lib/backend-api';

const courses = await backendAPI.courses.getUserCourses(userId);
```

---

## ⚠️ 注意事项

1. **认证处理**：当前 Backend API 使用 `user_id` 查询参数，建议改为 JWT Token
2. **错误处理**：确保错误格式一致
3. **CORS 配置**：确保 Backend 允许前端域名访问
4. **数据格式**：确保返回格式与前端期望一致

---

## 📚 相关文档

- [迁移到 Backend API 文档](./docs/migration-to-backend-api.md)
- [API 架构设计](./docs/api-architecture.md)

---

*最后更新：2024-12-25*

