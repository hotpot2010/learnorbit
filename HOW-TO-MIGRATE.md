# 🚀 数据库迁移快速指南

## 🎯 目标

将 LearnOrbit 项目从 Supabase (PostgreSQL) 迁移到 MySQL（阿里云 RDS）

## ⚠️ 重要说明

**所有表使用 `learnorbit_` 前缀**，避免与公司其他业务表冲突。

详细说明请查看：[表前缀说明文档](./docs/table-prefix-explanation.md)

---

## ⚡ 快速开始（3 步完成迁移）

### 步骤 1：安装依赖

```bash
npm install mysql2
```

### 步骤 2：创建数据库表

```bash
# 连接到 MySQL 数据库
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing

# 执行建表脚本
source migrations/mysql/001_initial_schema.sql;

# 或使用命令行一步完成
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql
```

### 步骤 3：切换到 MySQL

```bash
# 使用自动切换脚本
./scripts/switch-database.sh mysql

# 更新环境变量
# 在 .env 文件中修改：
# DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

**完成！现在启动应用测试：**

```bash
npm run dev
```

---

## 📋 详细步骤（含数据迁移）

如果你需要从 Supabase 导入现有数据：

### 1. 准备环境变量

在 `.env` 文件中添加：

```bash
# 原 Supabase 连接（用于导出数据）
SUPABASE_DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"

# 新 MySQL 连接（迁移目标）
MYSQL_DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

### 2. 创建 MySQL 表结构

```bash
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql
```

### 3. 运行数据迁移脚本

```bash
# 方式 1: 使用 npm 脚本
npm run db:migrate:to-mysql

# 方式 2: 直接运行
SUPABASE_DATABASE_URL="postgresql://..." \
MYSQL_DATABASE_URL="mysql://..." \
npx tsx scripts/migrate-to-mysql.ts
```

**迁移输出示例：**
```
🚀 开始数据库迁移: Supabase → MySQL
============================================================
✅ PostgreSQL 连接成功
✅ MySQL 连接成功

📦 开始迁移表: user
   📊 读取到 1234 条记录
   ✅ 成功: 1234 条

📦 开始迁移表: user_courses
   📊 读取到 2000 条记录
   ✅ 成功: 2000 条

...

🎉 所有表迁移成功！
```

### 4. 切换应用到 MySQL

```bash
# 使用切换脚本（推荐）
npm run db:switch:mysql

# 或手动切换
./scripts/switch-database.sh mysql
```

### 5. 更新环境变量

确保 `.env` 中的 `DATABASE_URL` 指向 MySQL：

```bash
DATABASE_URL="mysql://gt_ai_writing_rw:密码@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

### 6. 测试应用

```bash
npm run dev
```

访问 http://localhost:3000 测试以下功能：

- ✅ 用户登录/注册
- ✅ 课程创建和查看
- ✅ 视频笔记保存
- ✅ 标签管理
- ✅ 用户行为记录

---

## 🔄 如何回滚到 Supabase

如果迁移后遇到问题，可以快速回滚：

```bash
# 方式 1: 使用 npm 脚本
npm run db:switch:postgres

# 方式 2: 使用切换脚本
./scripts/switch-database.sh postgres

# 确保 .env 中的 DATABASE_URL 指向 Supabase
DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"

# 重启应用
npm run dev
```

---

## 📊 验证迁移结果

### 检查数据完整性

```sql
-- 登录 MySQL
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing

-- 查看所有 LearnOrbit 表（带前缀）
SHOW TABLES LIKE 'learnorbit_%';

-- 检查记录数（注意表名前缀）
SELECT 'learnorbit_user' as table_name, COUNT(*) as count FROM learnorbit_user
UNION ALL
SELECT 'learnorbit_session', COUNT(*) FROM learnorbit_session
UNION ALL
SELECT 'learnorbit_user_courses', COUNT(*) FROM learnorbit_user_courses
UNION ALL
SELECT 'learnorbit_user_video_notes', COUNT(*) FROM learnorbit_user_video_notes;

-- 检查 JSON 字段（注意表名前缀）
SELECT id, JSON_EXTRACT(course_plan, '$.plan') 
FROM learnorbit_user_courses LIMIT 5;

-- 检查外键完整性（注意表名前缀）
SELECT COUNT(*) FROM learnorbit_user_video_notes 
WHERE user_id NOT IN (SELECT id FROM learnorbit_user);
-- 应该返回 0
```

### 验证表前缀

```sql
-- 确认所有表都有 learnorbit_ 前缀
SELECT TABLE_NAME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'gt_ai_writing' 
  AND TABLE_NAME LIKE 'learnorbit_%'
ORDER BY TABLE_NAME;

-- 应该看到 11 个表
```

---

## 🎯 npm 脚本命令

已在 `package.json` 中添加了以下快捷命令：

```bash
# 数据迁移（从 Supabase 到 MySQL）
npm run db:migrate:to-mysql

# 切换到 MySQL
npm run db:switch:mysql

# 切换回 PostgreSQL (Supabase)
npm run db:switch:postgres
```

---

## ❓ 常见问题

### Q1: 迁移脚本报错 "Cannot find module 'mysql2'"

```bash
# 解决：安装 mysql2 依赖
npm install mysql2
```

### Q2: 连接 MySQL 失败

```bash
# 检查：
# 1. 数据库地址是否正确
# 2. 用户名密码是否正确
# 3. 数据库是否允许远程连接
# 4. 防火墙/安全组是否开放 3306 端口
```

### Q3: 表已存在无法创建

```sql
-- ⚠️ 只删除 LearnOrbit 的表（不影响其他业务）
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

-- 然后重新执行建表脚本
```

### Q4: JSON 字段查询报错

MySQL 的 JSON 查询语法与 PostgreSQL 不同，但 Drizzle ORM 会自动处理，无需修改代码。

### Q5: 迁移后数据不一致

```bash
# 1. 检查迁移日志
npm run db:migrate:to-mysql

# 2. 对比记录数
# PostgreSQL:
psql -c "SELECT COUNT(*) FROM user;"

# MySQL (注意表名前缀):
mysql -e "SELECT COUNT(*) FROM learnorbit_user;"

# 3. 如果不一致，重新运行迁移脚本
```

### Q6: 应用代码需要修改表名吗？

**不需要！** 虽然数据库表名使用了 `learnorbit_` 前缀，但应用代码完全不需要修改。Drizzle ORM 会自动处理表名映射。

```typescript
// ✅ 代码保持不变
import { user, userCourses } from '@/db/schema';

// Drizzle 会自动使用 learnorbit_user 表
const users = await db.select().from(user);
```

---

## 📁 相关文件位置

| 文件 | 说明 |
|------|------|
| `migrations/mysql/001_initial_schema.sql` | MySQL 建表 SQL（带 learnorbit_ 前缀） |
| `src/db/schema.mysql.ts` | MySQL Schema 定义（带前缀） |
| `src/db/index.mysql.ts` | MySQL 连接配置 |
| `scripts/migrate-to-mysql.ts` | 数据迁移工具（自动处理表名映射） |
| `scripts/switch-database.sh` | 数据库切换脚本 |
| `docs/table-prefix-explanation.md` | 表前缀详细说明 |
| `docs/database-migration-to-mysql.md` | 详细迁移文档 |
| `docs/database-architecture.md` | 数据库架构说明 |
| `QUICK-START-WITH-PREFIX.md` | 带前缀的快速开始指南 |
| `MIGRATION-SUMMARY.md` | 迁移工作总结 |

---

## 📚 进一步阅读

- 📖 [表前缀说明](./docs/table-prefix-explanation.md) - **重要！了解表前缀的使用**
- 📖 [带前缀的快速开始](./QUICK-START-WITH-PREFIX.md) - 针对公司数据库的快速指南
- 📖 [完整迁移指南](./docs/database-migration-to-mysql.md)
- 📖 [数据库架构说明](./docs/database-architecture.md)
- 📖 [数据库连接池优化](./docs/database-connection-pool-explained.md)

---

## ✅ 迁移检查清单

迁移完成后，请确认以下项目：

- [ ] MySQL 依赖已安装 (`npm install mysql2`)
- [ ] MySQL 表结构已创建（11 个表）
- [ ] 数据已迁移（如需要）
- [ ] 应用已切换到 MySQL
- [ ] 环境变量已更新
- [ ] 用户登录测试通过
- [ ] 课程功能测试通过
- [ ] 视频笔记功能测试通过
- [ ] 没有控制台错误
- [ ] Supabase 数据已备份（迁移前）

---

## 🎉 完成！

恭喜你完成了数据库迁移！

如有问题，请参考：
- [详细迁移文档](./docs/database-migration-to-mysql.md)
- [常见问题解答](./docs/database-migration-to-mysql.md#常见问题)

---

*创建日期：2024-12-25*

