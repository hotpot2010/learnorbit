# 数据库架构说明

## 📊 项目数据库架构概览

LearnOrbit 项目使用**双数据库架构**，分别负责不同的业务模块。

---

## 🗄️ 数据库 1：Supabase (PostgreSQL) → MySQL（主应用数据库）

### 用途
存储主应用的核心业务数据，包括用户、课程、笔记和分析数据。

### 数据库信息
- **类型**：PostgreSQL (Supabase) **→ 迁移到 MySQL**
- **位置**：国外 (Supabase) **→ 国内（阿里云 RDS）**
- **连接方式**：DATABASE_URL 环境变量

### 数据表结构

#### 1️⃣ 用户认证模块

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `user` | 用户信息 | id, name, email, role, customerId |
| `session` | 用户会话 | id, token, userId, expiresAt |
| `account` | 第三方账号 | accountId, providerId, userId, accessToken |
| `verification` | 验证码 | identifier, value, expiresAt |
| `payment` | 支付订阅 | priceId, subscriptionId, status, periodEnd |

#### 2️⃣ 学习课程模块

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `user_courses` | 用户课程 | id, userId, coursePlan (JSON), currentStep, status |
| `creator_courses` | 公开课程 | slug, courseId, creatorId, title, isActive |

**coursePlan 结构**：
```typescript
{
  plan: LearningPlan,      // 课程学习计划
  tasks: Record<string, any>, // 生成的任务
  notes: any[],            // 页面便签
  marks: any[],            // 文本标记
  isPublic: boolean        // 是否公开
}
```

#### 3️⃣ 用户行为分析

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `key_actions` | 关键行为追踪 | eventName, userId, actionData (JSON), timestamp |

**追踪的事件**：
- `generate_course` - 生成课程
- `start_learning` - 开始学习
- `continue_learning` - 继续学习
- `start_video_learning` - 开始视频学习
- `video_search` - 视频搜索
- `video_ask_question` - 提问
- `video_screenshot` - 截图
- `video_exercise` - 做练习

#### 4️⃣ 视频笔记模块

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `user_video_notes` | 用户视频笔记 | taskId, userId, userNotesData (JSON), videoUrl |
| `video_note_tags` | 笔记标签 | name, color, userId |
| `video_note_tag_relations` | 笔记-标签关联 | noteId, tagId |

**userNotesData 结构**：
```typescript
{
  knowledgePointNotes: [{
    knowledgePointName: string,
    startTime: string,
    endTime: string,
    qaList: [...],         // 问答列表
    screenshots: [...],    // 截图列表
    exercises: [...],      // 练习题
    searchResults: [...],  // 搜索结果
    customNote: string     // 自定义笔记
  }],
  customTitle: string,
  tags: string[]
}
```

---

## 🗄️ 数据库 2：MySQL (阿里云 RDS)（视频处理数据库）

### 用途
存储视频处理任务和结果，由后端 FastAPI 服务使用。

### 数据库信息
- **类型**：MySQL 8.0
- **位置**：阿里云 RDS（国内）
- **数据库名**：`gt_ai_writing`
- **用途**：视频处理任务管理

### 数据表结构

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `offline_video_tasks` | 离线视频处理任务 | task_id, bilibili_url, video_title, steps (JSON) |
| | | video_url, transcoded_video_url |
| | | asr_result_url, knowledge_points_result_url |
| | | screenshots_result_url, exercises_result_url |
| | | is_series, series_parts (JSON) |

**步骤流程**：
```
1. 下载视频 → video_url
2. 转码处理 → transcoded_video_url
3. ASR 识别 → asr_result_url
4. 提取知识点 → knowledge_points_result_url
5. 生成截图 → screenshots_result_url
6. 生成练习 → exercises_result_url
```

---

## 🔗 两个数据库的关联关系

### 数据流向

```
用户提交视频
    ↓
Backend (FastAPI) → MySQL 创建任务
    ↓
task_id 返回给前端
    ↓
前端 Next.js → Supabase/MySQL 创建笔记
    ↓
user_video_notes.taskId = offline_video_tasks.task_id
```

### 关联字段

| Supabase/MySQL 表 | MySQL 表 | 关联字段 |
|-------------------|----------|---------|
| `user_video_notes` | `offline_video_tasks` | `taskId` ↔ `task_id` |

### 查询示例

**前端查询用户的视频笔记**：
```typescript
// 1. 从 Supabase/MySQL 查询笔记
const notes = await db.select()
  .from(userVideoNotes)
  .where(eq(userVideoNotes.userId, userId));

// 2. 根据 taskId 从 MySQL 查询原始视频数据
const taskId = notes[0].taskId;
const videoTask = await fetch(`/api/video/task/${taskId}`);

// 3. 组合数据展示给用户
```

---

## 🚀 迁移到统一 MySQL 架构（推荐）

### 迁移优势

1. **统一技术栈**：全部使用 MySQL，简化维护
2. **降低成本**：共享同一个 MySQL 实例
3. **提升性能**：数据库在国内，访问速度更快
4. **简化架构**：减少数据库数量，降低复杂度

### 迁移后架构

```
统一 MySQL 数据库 (阿里云 RDS)
├── 用户认证表（从 Supabase 迁移）
├── 课程数据表（从 Supabase 迁移）
├── 视频笔记表（从 Supabase 迁移）
└── 视频任务表（原有 MySQL）
```

### 迁移指南

详见：[数据库迁移指南](./database-migration-to-mysql.md)

---

## 📊 数据量统计（估算）

| 表名 | 记录数 | 增长速度 |
|------|--------|---------|
| user | ~1,000 | 10-50/天 |
| session | ~500 | 活跃用户数 |
| user_courses | ~2,000 | 20-100/天 |
| user_video_notes | ~500 | 5-20/天 |
| key_actions | ~10,000 | 100-500/天 |
| offline_video_tasks | ~300 | 5-15/天 |

---

## 🔐 权限说明

### Supabase / MySQL（主数据库）

- **读写权限**：Next.js 应用
- **访问方式**：DATABASE_URL 环境变量
- **连接池**：每个 Serverless 实例 1 个连接

### MySQL（视频处理）

- **读写权限**：FastAPI 后端
- **访问方式**：backend/app/database.py
- **连接池**：pool_size=5, max_overflow=10

---

## 🛡️ 安全措施

1. **连接加密**：使用 SSL/TLS 连接
2. **密码管理**：通过环境变量配置，不提交到代码库
3. **访问控制**：Row Level Security (RLS) - Supabase
4. **备份策略**：每日自动备份
5. **审计日志**：记录关键操作

---

## 📈 性能优化

### 索引策略

**高频查询字段已建立索引**：
- `user.email` (UNIQUE)
- `session.token` (UNIQUE)
- `user_courses.user_id`
- `user_video_notes.task_id`
- `user_video_notes.bv_id`
- `key_actions.event_name`
- `key_actions.user_id`

### 连接池配置

```typescript
// Supabase (PostgreSQL) / MySQL
生产环境: max: 1 (Serverless)
开发环境: max: 3

// MySQL (视频处理)
pool_size: 5
max_overflow: 10
pool_recycle: 3600 (1小时)
```

### 查询优化

- 使用 Drizzle ORM 的查询构建器
- 避免 N+1 查询问题
- 合理使用 JSON 字段存储复杂数据
- 定期分析慢查询日志

---

## 🔄 数据备份

### Supabase 备份（迁移前）

- **方式**：Supabase Dashboard 导出
- **频率**：迁移前必须备份
- **保留**：迁移后保留 1-2 周

### MySQL 备份

- **方式**：阿里云 RDS 自动备份
- **频率**：每日
- **保留周期**：7 天

---

## 📚 相关文档

- [数据库迁移指南](./database-migration-to-mysql.md)
- [数据库连接池优化](./database-connection-pool-explained.md)
- [Drizzle ORM 使用指南](https://orm.drizzle.team/docs/overview)

---

*最后更新：2024-12-25*


