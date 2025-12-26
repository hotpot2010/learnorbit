# ✅ 表前缀更新完成总结

## 🎯 更新内容

根据你的需求，已将所有数据库表名添加 `learnorbit_` 前缀，避免与公司其他业务表冲突。

---

## 📊 表名变更对照

| 原表名 (PostgreSQL) | 新表名 (MySQL) | 说明 |
|-------------------|---------------|------|
| `user` | `learnorbit_user` | ✅ 已更新 |
| `session` | `learnorbit_session` | ✅ 已更新 |
| `account` | `learnorbit_account` | ✅ 已更新 |
| `verification` | `learnorbit_verification` | ✅ 已更新 |
| `payment` | `learnorbit_payment` | ✅ 已更新 |
| `user_courses` | `learnorbit_user_courses` | ✅ 已更新 |
| `creator_courses` | `learnorbit_creator_courses` | ✅ 已更新 |
| `key_actions` | `learnorbit_key_actions` | ✅ 已更新 |
| `user_video_notes` | `learnorbit_user_video_notes` | ✅ 已更新 |
| `video_note_tags` | `learnorbit_video_note_tags` | ✅ 已更新 |
| `video_note_tag_relations` | `learnorbit_video_note_tag_relations` | ✅ 已更新 |

**共 11 个表，全部添加 `learnorbit_` 前缀**

---

## 📝 已更新的文件

### 1. 数据库 Schema 和迁移脚本

✅ **`migrations/mysql/001_initial_schema.sql`**
- 所有 `CREATE TABLE` 语句使用 `learnorbit_` 前缀
- 所有外键约束名称使用 `learnorbit_` 前缀
- 外键引用的表名使用 `learnorbit_` 前缀

✅ **`src/db/schema.mysql.ts`**
- 所有 `mysqlTable()` 调用使用 `learnorbit_` 前缀
- 外键关系引用正确

✅ **`scripts/migrate-to-mysql.ts`**
- 更新表名映射：`{ pg: 'user', mysql: 'learnorbit_user' }`
- 自动处理 PostgreSQL → MySQL 表名转换
- 迁移日志显示完整的表名映射

### 2. 文档更新

✅ **新增文档**
- `docs/table-prefix-explanation.md` - 表前缀详细说明
- `QUICK-START-WITH-PREFIX.md` - 带前缀的快速开始指南
- `TABLE-PREFIX-UPDATE-SUMMARY.md` - 本文档

✅ **更新文档**
- `HOW-TO-MIGRATE.md` - 添加表前缀说明和注意事项
- 所有 SQL 示例都使用带前缀的表名

---

## 🚀 如何使用

### 方式 1：全新安装（推荐）

```bash
# 1. 安装依赖
npm install mysql2

# 2. 创建表（自动使用 learnorbit_ 前缀）
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql

# 3. 验证表创建
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      -e "SHOW TABLES LIKE 'learnorbit_%';"

# 应该看到 11 个表

# 4. 切换应用到 MySQL
./scripts/switch-database.sh mysql

# 5. 更新环境变量
# DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"

# 6. 启动应用
npm run dev
```

### 方式 2：迁移现有数据

```bash
# 1. 创建表（同上）
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql

# 2. 配置环境变量
export SUPABASE_DATABASE_URL="postgresql://..."
export MYSQL_DATABASE_URL="mysql://..."

# 3. 运行迁移（自动处理表名映射）
npm run db:migrate:to-mysql

# 输出示例：
# 📦 开始迁移表: user → learnorbit_user
#    📊 读取到 1234 条记录
#    ✅ 成功: 1234 条
#
# 📦 开始迁移表: user_courses → learnorbit_user_courses
#    📊 读取到 2000 条记录
#    ✅ 成功: 2000 条

# 4. 切换应用
./scripts/switch-database.sh mysql

# 5. 启动应用
npm run dev
```

---

## ✅ 验证清单

### 1. 验证表创建

```sql
-- 登录 MySQL
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing

-- 查看所有 LearnOrbit 表
SHOW TABLES LIKE 'learnorbit_%';

-- 应该看到 11 个表：
-- learnorbit_account
-- learnorbit_creator_courses
-- learnorbit_key_actions
-- learnorbit_payment
-- learnorbit_session
-- learnorbit_user
-- learnorbit_user_courses
-- learnorbit_user_video_notes
-- learnorbit_verification
-- learnorbit_video_note_tag_relations
-- learnorbit_video_note_tags
```

### 2. 验证表结构

```sql
-- 查看用户表结构
DESC learnorbit_user;

-- 查看外键约束
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'gt_ai_writing'
  AND TABLE_NAME LIKE 'learnorbit_%'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### 3. 验证应用功能

```bash
# 启动应用
npm run dev

# 测试功能：
# ✅ 用户注册/登录
# ✅ 课程创建
# ✅ 视频笔记保存
# ✅ 标签管理
```

---

## 💡 重要说明

### ✅ 应用代码无需修改

虽然数据库表名使用了 `learnorbit_` 前缀，但**应用代码完全不需要修改**！

```typescript
// ✅ 代码保持不变
import { user, session, userCourses } from '@/db/schema';

// Drizzle ORM 会自动使用带前缀的表名
const users = await db.select().from(user); // 查询 learnorbit_user
const courses = await db.select().from(userCourses); // 查询 learnorbit_user_courses
```

### ✅ 与其他业务表隔离

使用 `learnorbit_` 前缀后：
- ✅ 不会与公司其他业务表冲突
- ✅ 容易识别哪些表属于 LearnOrbit
- ✅ 便于批量管理和备份

```sql
-- 只查看 LearnOrbit 的表
SHOW TABLES LIKE 'learnorbit_%';

-- 只备份 LearnOrbit 的数据
mysqldump ... --tables learnorbit_* > backup.sql
```

---

## 📚 相关文档

### 必读文档

- 📖 **[表前缀说明](./docs/table-prefix-explanation.md)** - 详细了解表前缀的使用
- 📖 **[快速开始（带前缀）](./QUICK-START-WITH-PREFIX.md)** - 3 步完成迁移

### 参考文档

- 📖 [完整迁移指南](./docs/database-migration-to-mysql.md)
- 📖 [数据库架构说明](./docs/database-architecture.md)
- 📖 [快速迁移指南](./HOW-TO-MIGRATE.md)

---

## 🔧 技术细节

### 迁移脚本的表名映射

`scripts/migrate-to-mysql.ts` 中的表名映射：

```typescript
const tables = [
  { pg: 'user', mysql: 'learnorbit_user' },
  { pg: 'session', mysql: 'learnorbit_session' },
  { pg: 'account', mysql: 'learnorbit_account' },
  { pg: 'verification', mysql: 'learnorbit_verification' },
  { pg: 'payment', mysql: 'learnorbit_payment' },
  { pg: 'user_courses', mysql: 'learnorbit_user_courses' },
  { pg: 'creator_courses', mysql: 'learnorbit_creator_courses' },
  { pg: 'key_actions', mysql: 'learnorbit_key_actions' },
  { pg: 'user_video_notes', mysql: 'learnorbit_user_video_notes' },
  { pg: 'video_note_tags', mysql: 'learnorbit_video_note_tags' },
  { pg: 'video_note_tag_relations', mysql: 'learnorbit_video_note_tag_relations' },
];
```

### Drizzle Schema 定义

`src/db/schema.mysql.ts` 中的表定义：

```typescript
export const user = mysqlTable("learnorbit_user", { ... });
export const session = mysqlTable("learnorbit_session", { ... });
export const userCourses = mysqlTable('learnorbit_user_courses', { ... });
// ...
```

### 外键约束命名

所有外键约束也使用 `learnorbit_` 前缀：

```sql
CONSTRAINT `learnorbit_session_user_id_fk` 
  FOREIGN KEY (`user_id`) 
  REFERENCES `learnorbit_user`(`id`) 
  ON DELETE CASCADE
```

---

## 🎯 下一步

1. **测试迁移流程**
   ```bash
   # 在测试环境先跑一遍
   ./scripts/switch-database.sh mysql
   npm run dev
   ```

2. **验证所有功能**
   - 用户认证
   - 课程管理
   - 视频笔记
   - 标签系统

3. **准备生产部署**
   - 选择低峰期
   - 备份 Supabase 数据
   - 执行迁移
   - 监控观察

---

## ✅ 更新完成确认

- [x] 所有表名添加 `learnorbit_` 前缀
- [x] 建表脚本已更新
- [x] Drizzle Schema 已更新
- [x] 迁移脚本已更新（支持表名映射）
- [x] 外键约束名称已更新
- [x] 文档已更新
- [x] 快速开始指南已创建
- [x] 应用代码无需修改（Drizzle 自动处理）

---

**更新日期**：2024-12-25  
**状态**：✅ 已完成  
**版本**：v2.0（带表前缀）

---

🎉 **所有表前缀更新已完成！现在可以安全地迁移到公司的 MySQL 数据库了！**


