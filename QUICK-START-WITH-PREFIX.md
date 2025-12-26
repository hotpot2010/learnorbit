# 🚀 快速开始（带表前缀版本）

## 📌 重要说明

由于使用公司共享的 MySQL 数据库，所有表名都使用 `learnorbit_` 前缀，避免与其他业务表冲突。

---

## ⚡ 3 步完成迁移

### 步骤 1：安装依赖

```bash
npm install mysql2
```

### 步骤 2：创建数据库表（带前缀）

```bash
# 连接到公司 MySQL 数据库
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql
```

**将创建以下表**（共 11 个）：
- ✅ `learnorbit_user`
- ✅ `learnorbit_session`
- ✅ `learnorbit_account`
- ✅ `learnorbit_verification`
- ✅ `learnorbit_payment`
- ✅ `learnorbit_user_courses`
- ✅ `learnorbit_creator_courses`
- ✅ `learnorbit_key_actions`
- ✅ `learnorbit_user_video_notes`
- ✅ `learnorbit_video_note_tags`
- ✅ `learnorbit_video_note_tag_relations`

### 步骤 3：切换到 MySQL

```bash
# 使用自动切换脚本
./scripts/switch-database.sh mysql

# 更新 .env 文件
DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

**完成！启动应用：**

```bash
npm run dev
```

---

## 🔍 验证表创建

```bash
# 登录 MySQL
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing

# 查看创建的表
SHOW TABLES LIKE 'learnorbit_%';

# 应该看到 11 个表
```

**SQL 输出示例**：
```
+-------------------------------------------+
| Tables_in_gt_ai_writing (learnorbit_%)   |
+-------------------------------------------+
| learnorbit_account                        |
| learnorbit_creator_courses                |
| learnorbit_key_actions                    |
| learnorbit_payment                        |
| learnorbit_session                        |
| learnorbit_user                           |
| learnorbit_user_courses                   |
| learnorbit_user_video_notes               |
| learnorbit_video_note_tag_relations       |
| learnorbit_video_note_tags                |
| learnorbit_verification                   |
+-------------------------------------------+
11 rows in set
```

---

## 📊 查看表详情

```sql
-- 查看表结构和统计信息
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'gt_ai_writing'
  AND TABLE_NAME LIKE 'learnorbit_%'
ORDER BY TABLE_NAME;
```

---

## 💡 重要提示

### ✅ 应用代码无需修改

虽然数据库表名使用了 `learnorbit_` 前缀，但**应用代码完全不需要修改**！

```typescript
// ✅ 代码保持不变
import { user, userCourses } from '@/db/schema';

// 查询用户（Drizzle 会自动使用 learnorbit_user 表）
const users = await db.select().from(user);

// 查询课程（Drizzle 会自动使用 learnorbit_user_courses 表）
const courses = await db.select().from(userCourses);
```

Drizzle ORM 会自动处理表名映射！

---

## 🔄 迁移现有数据（可选）

如果需要从 Supabase 迁移数据：

```bash
# 1. 配置环境变量
export SUPABASE_DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"
export MYSQL_DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"

# 2. 运行迁移（自动处理表名映射）
npm run db:migrate:to-mysql
```

**迁移脚本会自动**：
- 从 Supabase 的 `user` 表读取 → 插入到 MySQL 的 `learnorbit_user` 表
- 从 Supabase 的 `user_courses` 表读取 → 插入到 MySQL 的 `learnorbit_user_courses` 表
- 以此类推...

---

## 🧪 测试功能

启动应用后，测试以下功能：

```bash
npm run dev
```

访问 http://localhost:3000

- ✅ 用户注册/登录
- ✅ Google OAuth 登录
- ✅ 创建课程
- ✅ 保存视频笔记
- ✅ 添加标签

---

## 📚 相关文档

- 📖 [表前缀说明](./docs/table-prefix-explanation.md) - 详细了解表前缀的使用
- 📖 [完整迁移指南](./docs/database-migration-to-mysql.md) - 详细迁移步骤
- 📖 [快速迁移指南](./HOW-TO-MIGRATE.md) - 3 步快速迁移

---

## ❓ 常见问题

### Q: 为什么要使用表前缀？

A: 因为使用的是公司共享的 MySQL 数据库，里面有其他业务的表。使用 `learnorbit_` 前缀可以：
- ✅ 避免表名冲突
- ✅ 清晰识别哪些表属于 LearnOrbit
- ✅ 便于批量管理和备份

### Q: 应用代码需要修改吗？

A: **不需要！** Drizzle ORM 会自动处理表名映射，应用代码保持不变。

### Q: 如何查看只属于 LearnOrbit 的表？

```sql
SHOW TABLES LIKE 'learnorbit_%';
```

### Q: 如何只备份 LearnOrbit 的数据？

```bash
# 只导出 learnorbit_ 开头的表
mysqldump -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
          -u gt_ai_writing_rw \
          -p gt_ai_writing \
          --tables $(mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
                     -u gt_ai_writing_rw \
                     -p -Nse "SHOW TABLES LIKE 'learnorbit_%'" gt_ai_writing) \
          > learnorbit_backup_$(date +%Y%m%d).sql
```

### Q: 如何删除所有 LearnOrbit 的表？

```sql
-- ⚠️ 谨慎操作！这会删除所有 LearnOrbit 的表

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS learnorbit_video_note_tag_relations;
DROP TABLE IF EXISTS learnorbit_video_note_tags;
DROP TABLE IF EXISTS learnorbit_user_video_notes;
DROP TABLE IF EXISTS learnorbit_key_actions;
DROP TABLE IF EXISTS learnorbit_creator_courses;
DROP TABLE IF EXISTS learnorbit_user_courses;
DROP TABLE IF EXISTS learnorbit_payment;
DROP TABLE IF EXISTS learnorbit_verification;
DROP TABLE IF EXISTS learnorbit_account;
DROP TABLE IF EXISTS learnorbit_session;
DROP TABLE IF EXISTS learnorbit_user;

SET FOREIGN_KEY_CHECKS = 1;
```

---

## ✅ 检查清单

迁移完成后，请确认：

- [ ] MySQL 依赖已安装 (`npm install mysql2`)
- [ ] 11 个 `learnorbit_*` 表已创建
- [ ] 应用已切换到 MySQL (`./scripts/switch-database.sh mysql`)
- [ ] 环境变量已更新 (`DATABASE_URL` 指向 MySQL)
- [ ] 应用可以正常启动 (`npm run dev`)
- [ ] 用户登录功能正常
- [ ] 课程功能正常
- [ ] 视频笔记功能正常
- [ ] 没有控制台错误

---

## 🎉 完成！

恭喜！你已经成功将 LearnOrbit 迁移到公司的 MySQL 数据库，并使用了 `learnorbit_` 表前缀来避免冲突。

如有问题，请查看：
- [表前缀详细说明](./docs/table-prefix-explanation.md)
- [完整迁移指南](./docs/database-migration-to-mysql.md)

---

*创建日期：2024-12-25*

