# 数据库表前缀说明

## 📋 为什么使用表前缀？

由于使用的是**公司共享的 MySQL 数据库**，里面已经有其他业务的表，为了避免表名冲突，所有 LearnOrbit 项目的表都使用 `learnorbit_` 前缀。

---

## 📊 表名映射

### Supabase (PostgreSQL) → MySQL 表名对照

| PostgreSQL 表名 | MySQL 表名 | 说明 |
|----------------|-----------|------|
| `user` | `learnorbit_user` | 用户表 |
| `session` | `learnorbit_session` | 会话表 |
| `account` | `learnorbit_account` | 第三方账户表 |
| `verification` | `learnorbit_verification` | 验证表 |
| `payment` | `learnorbit_payment` | 支付表 |
| `user_courses` | `learnorbit_user_courses` | 用户课程表 |
| `creator_courses` | `learnorbit_creator_courses` | 创作者课程表 |
| `key_actions` | `learnorbit_key_actions` | 关键行为表 |
| `user_video_notes` | `learnorbit_user_video_notes` | 视频笔记表 |
| `video_note_tags` | `learnorbit_video_note_tags` | 笔记标签表 |
| `video_note_tag_relations` | `learnorbit_video_note_tag_relations` | 笔记标签关联表 |

---

## 🔧 代码中的处理

### Drizzle ORM Schema

在 `src/db/schema.mysql.ts` 中，所有表定义都使用带前缀的表名：

```typescript
// ✅ 正确：使用 learnorbit_ 前缀
export const user = mysqlTable("learnorbit_user", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // ...
});

export const session = mysqlTable("learnorbit_session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  // ...
});

export const userCourses = mysqlTable('learnorbit_user_courses', {
  id: varchar('id', { length: 255 }).primaryKey(),
  // ...
});
```

### 应用代码无需修改

**重要**：虽然数据库表名使用了前缀，但在应用代码中使用时**不需要修改任何代码**！

```typescript
// ✅ 代码保持不变
import { user, session, userCourses } from '@/db/schema';

// 查询用户
const users = await db.select().from(user);

// 查询课程
const courses = await db.select().from(userCourses)
  .where(eq(userCourses.userId, userId));
```

Drizzle ORM 会自动处理表名映射，你只需要使用导出的变量名即可。

---

## 📝 迁移脚本的处理

### 数据迁移工具

`scripts/migrate-to-mysql.ts` 已更新，支持 PostgreSQL 表名到 MySQL 表名的自动映射：

```typescript
const tables = [
  { pg: 'user', mysql: 'learnorbit_user' },
  { pg: 'session', mysql: 'learnorbit_session' },
  { pg: 'user_courses', mysql: 'learnorbit_user_courses' },
  // ...
];
```

迁移时会自动：
1. 从 PostgreSQL 的 `user` 表读取数据
2. 插入到 MySQL 的 `learnorbit_user` 表

---

## 🗄️ 数据库表结构

### 查看所有 LearnOrbit 表

```sql
-- 查看所有 learnorbit_ 开头的表
SHOW TABLES LIKE 'learnorbit_%';

-- 应该看到 11 个表：
-- learnorbit_user
-- learnorbit_session
-- learnorbit_account
-- learnorbit_verification
-- learnorbit_payment
-- learnorbit_user_courses
-- learnorbit_creator_courses
-- learnorbit_key_actions
-- learnorbit_user_video_notes
-- learnorbit_video_note_tags
-- learnorbit_video_note_tag_relations
```

### 查看表统计信息

```sql
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME LIKE 'learnorbit_%'
ORDER BY TABLE_NAME;
```

---

## 🔍 外键约束命名

所有外键约束也使用 `learnorbit_` 前缀：

```sql
-- ✅ 外键约束命名示例
CONSTRAINT `learnorbit_session_user_id_fk` 
  FOREIGN KEY (`user_id`) 
  REFERENCES `learnorbit_user`(`id`) 
  ON DELETE CASCADE

CONSTRAINT `learnorbit_user_courses_user_id_fk` 
  FOREIGN KEY (`user_id`) 
  REFERENCES `learnorbit_user`(`id`) 
  ON DELETE CASCADE
```

---

## 🚀 迁移步骤

### 1. 创建表结构

```bash
# 执行建表脚本（已包含 learnorbit_ 前缀）
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql
```

### 2. 验证表创建

```sql
-- 登录 MySQL
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing

-- 查看创建的表
SHOW TABLES LIKE 'learnorbit_%';

-- 应该看到 11 个表
```

### 3. 迁移数据（可选）

```bash
# 运行迁移脚本（自动处理表名映射）
npm run db:migrate:to-mysql
```

### 4. 切换应用

```bash
# 切换到 MySQL
npm run db:switch:mysql

# 启动应用
npm run dev
```

---

## ⚠️ 注意事项

### 1. 不要手动修改表名

所有表名已经在以下文件中配置好：
- `migrations/mysql/001_initial_schema.sql` - 建表脚本
- `src/db/schema.mysql.ts` - Drizzle Schema
- `scripts/migrate-to-mysql.ts` - 迁移脚本

**不需要手动修改任何表名！**

### 2. 应用代码无需改动

由于使用了 Drizzle ORM，应用代码中的查询语句**完全不需要修改**：

```typescript
// ❌ 不需要这样写
await db.select().from('learnorbit_user');

// ✅ 保持原样即可
await db.select().from(user);
```

### 3. 与其他业务表隔离

使用 `learnorbit_` 前缀后：
- ✅ 不会与其他业务表冲突
- ✅ 容易识别哪些表属于 LearnOrbit
- ✅ 便于批量管理和备份

```sql
-- 只备份 LearnOrbit 的表
mysqldump -h host -u user -p database \
  --tables $(mysql -h host -u user -p -Nse \
  "SHOW TABLES LIKE 'learnorbit_%'" database) \
  > learnorbit_backup.sql
```

---

## 📊 数据库空间占用

查看 LearnOrbit 表的空间占用：

```sql
SELECT 
  TABLE_NAME,
  ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS `Size (MB)`,
  TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME LIKE 'learnorbit_%'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
```

---

## 🔄 如果需要修改前缀

如果将来需要修改表前缀（例如改为 `lo_`），只需要修改以下 3 个文件：

1. **`migrations/mysql/001_initial_schema.sql`**
   ```sql
   -- 全局替换
   learnorbit_ → lo_
   ```

2. **`src/db/schema.mysql.ts`**
   ```typescript
   // 全局替换
   "learnorbit_user" → "lo_user"
   "learnorbit_session" → "lo_session"
   // ...
   ```

3. **`scripts/migrate-to-mysql.ts`**
   ```typescript
   // 更新表名映射
   { pg: 'user', mysql: 'lo_user' },
   { pg: 'session', mysql: 'lo_session' },
   // ...
   ```

---

## ✅ 总结

- ✅ 所有表使用 `learnorbit_` 前缀
- ✅ 避免与公司其他业务表冲突
- ✅ 应用代码无需修改
- ✅ Drizzle ORM 自动处理表名映射
- ✅ 迁移脚本自动处理 PostgreSQL → MySQL 表名转换

---

*最后更新：2024-12-25*


