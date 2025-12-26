# 数据库迁移指南：从 Supabase (PostgreSQL) 迁移到 MySQL

> 📅 创建日期：2024-12-25  
> 🎯 目标：将 LearnOrbit 项目的主数据库从 Supabase PostgreSQL 迁移到 MySQL

---

## 📋 目录

- [迁移概述](#迁移概述)
- [准备工作](#准备工作)
- [迁移步骤](#迁移步骤)
- [回滚方案](#回滚方案)
- [验证测试](#验证测试)
- [常见问题](#常见问题)

---

## 🎯 迁移概述

### 为什么要迁移？

1. **统一数据库技术栈**：后端已使用 MySQL (阿里云 RDS)，前端也统一使用 MySQL 便于维护
2. **降低成本**：可以使用同一个 MySQL 实例，减少数据库服务费用
3. **简化运维**：只需管理一种数据库，降低运维复杂度
4. **数据本地化**：数据存储在国内服务器，访问速度更快

### 迁移范围

迁移以下 Supabase 表到 MySQL：

| 表名 | 用途 | 记录数（估算） |
|------|------|---------------|
| `user` | 用户信息 | ~1000 |
| `session` | 用户会话 | ~500 |
| `account` | 第三方账户 | ~800 |
| `verification` | 验证码 | ~100 |
| `payment` | 支付订阅 | ~50 |
| `user_courses` | 用户课程 | ~2000 |
| `creator_courses` | 公开课程 | ~20 |
| `key_actions` | 用户行为 | ~10000 |
| `user_video_notes` | 视频笔记 | ~500 |
| `video_note_tags` | 笔记标签 | ~50 |
| `video_note_tag_relations` | 标签关联 | ~200 |

### 技术变更

| 项目 | 迁移前 | 迁移后 |
|------|--------|--------|
| 数据库 | PostgreSQL (Supabase) | MySQL (阿里云 RDS) |
| ORM | Drizzle ORM (postgres-js) | Drizzle ORM (mysql2) |
| 连接池 | postgres.js | mysql2 pool |
| 数据类型 | JSONB, TEXT, BIGINT | JSON, TEXT, BIGINT |

---

## 🛠️ 准备工作

### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- 访问 Supabase 数据库的权限
- 访问 MySQL 数据库的权限

### 2. 安装依赖

```bash
# 安装 MySQL 驱动
npm install mysql2

# 安装 Drizzle MySQL 适配器
npm install drizzle-orm@latest

# 安装迁移工具依赖
npm install tsx
```

### 3. 准备数据库连接字符串

在 `.env` 文件中配置：

```bash
# 原 Supabase 连接（用于数据导出）
SUPABASE_DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"

# 新 MySQL 连接（迁移目标）
DATABASE_URL="mysql://user:password@host:3306/database_name"
# 或使用已有的 MySQL 连接
MYSQL_DATABASE_URL="mysql://gt_ai_writing_rw:xxx@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

---

## 🚀 迁移步骤

### 步骤 1：创建 MySQL 数据库表结构

```bash
# 方式 1: 使用 MySQL 命令行
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com \
      -u gt_ai_writing_rw \
      -p gt_ai_writing \
      < migrations/mysql/001_initial_schema.sql

# 方式 2: 使用 MySQL Workbench
# 1. 连接到 MySQL 数据库
# 2. 打开 migrations/mysql/001_initial_schema.sql
# 3. 执行 SQL 脚本
```

**验证表是否创建成功：**

```sql
SHOW TABLES;

-- 应该看到 11 个表
-- user, session, account, verification, payment,
-- user_courses, creator_courses, key_actions,
-- user_video_notes, video_note_tags, video_note_tag_relations
```

### 步骤 2：备份 Supabase 数据（重要！）

```bash
# 使用 Supabase Dashboard 导出数据
# 或使用 pg_dump 命令
pg_dump -h db.xxx.supabase.co \
        -U postgres \
        -d postgres \
        -F c \
        -f backup-supabase-$(date +%Y%m%d).dump
```

### 步骤 3：迁移数据

```bash
# 设置环境变量
export SUPABASE_DATABASE_URL="postgresql://..."
export MYSQL_DATABASE_URL="mysql://..."

# 运行迁移脚本
npx tsx scripts/migrate-to-mysql.ts
```

**迁移过程输出示例：**

```
🚀 开始数据库迁移: Supabase → MySQL
============================================================

🔗 测试数据库连接...
   ✅ PostgreSQL 连接成功
   ✅ MySQL 连接成功

📦 开始迁移表: user
   📊 读取到 1234 条记录
   ✅ 成功: 1234 条

📦 开始迁移表: session
   📊 读取到 567 条记录
   ✅ 成功: 567 条

...

============================================================
📊 迁移完成统计:
   ✅ 成功: 11 个表
   ❌ 失败: 0 个表
   ⏱️  耗时: 12.34 秒
============================================================

🎉 所有表迁移成功！
```

### 步骤 4：切换应用到 MySQL

```bash
# 使用切换脚本（推荐）
./scripts/switch-database.sh mysql

# 或手动切换
cp src/db/index.mysql.ts src/db/index.ts
cp src/db/schema.mysql.ts src/db/schema.ts

# 更新 auth.ts 中的 provider
# 将 provider: 'pg' 改为 provider: 'mysql'
```

### 步骤 5：更新环境变量

确保 `.env` 中的 `DATABASE_URL` 指向 MySQL：

```bash
# 更新为 MySQL 连接字符串
DATABASE_URL="mysql://user:password@host:3306/database"
```

### 步骤 6：测试应用

```bash
# 启动开发服务器
npm run dev

# 测试关键功能：
# 1. 用户登录/注册
# 2. 课程创建/查询
# 3. 视频笔记保存/读取
# 4. 行为分析记录
```

---

## 🔄 回滚方案

如果迁移后出现问题，可以快速回滚到 Supabase：

```bash
# 方式 1: 使用切换脚本
./scripts/switch-database.sh postgres

# 方式 2: 手动回滚
# 1. 恢复原始文件
cp backups/db-config-YYYYMMDD-HHMMSS/index.ts src/db/index.ts
cp backups/db-config-YYYYMMDD-HHMMSS/schema.ts src/db/schema.ts

# 2. 更新环境变量
DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"

# 3. 重启应用
npm run dev
```

---

## ✅ 验证测试

### 数据完整性验证

```sql
-- 检查记录数是否一致
SELECT 'user' as table_name, COUNT(*) as count FROM user
UNION ALL
SELECT 'session', COUNT(*) FROM session
UNION ALL
SELECT 'user_courses', COUNT(*) FROM user_courses
UNION ALL
SELECT 'user_video_notes', COUNT(*) FROM user_video_notes;
```

### 功能测试清单

- [ ] 用户登录（邮箱密码）
- [ ] 用户登录（Google OAuth）
- [ ] 课程创建
- [ ] 课程进度更新
- [ ] 视频笔记保存
- [ ] 视频笔记读取
- [ ] 标签创建和关联
- [ ] 行为分析记录
- [ ] 支付订阅查询

### 性能测试

```bash
# 测试数据库连接池
# 查看连接数
SHOW PROCESSLIST;

# 查看慢查询
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

---

## 🔧 数据类型差异处理

### PostgreSQL → MySQL 映射

| PostgreSQL | MySQL | 说明 |
|------------|-------|------|
| `TEXT` | `TEXT` | 无需转换 |
| `JSONB` | `JSON` | MySQL 8.0+ 原生支持 JSON |
| `BOOLEAN` | `BOOLEAN` / `TINYINT(1)` | 存储为 0/1 |
| `TIMESTAMP` | `TIMESTAMP` / `DATETIME` | 需注意时区 |
| `BIGINT` | `BIGINT` | 无需转换 |
| `VARCHAR(n)` | `VARCHAR(n)` | 无需转换 |
| `ENUM` | `ENUM` | MySQL 原生支持 |

### 注意事项

1. **JSON 查询语法差异**
   ```sql
   -- PostgreSQL
   SELECT * FROM user_courses WHERE course_plan->>'status' = 'completed';
   
   -- MySQL
   SELECT * FROM user_courses WHERE JSON_EXTRACT(course_plan, '$.status') = 'completed';
   ```

2. **时间戳默认值**
   ```sql
   -- PostgreSQL: NOW()
   -- MySQL: CURRENT_TIMESTAMP 或 NOW()
   ```

3. **布尔值**
   ```javascript
   // MySQL 返回 0/1，需要转换为 boolean
   const isActive = row.is_active === 1;
   ```

---

## 📊 性能优化建议

### 连接池配置

```typescript
// 生产环境（Serverless）
connectionLimit: 1,
maxIdle: 1,
idleTimeout: 20000,

// 开发环境
connectionLimit: 3,
maxIdle: 2,
idleTimeout: 30000,
```

### 索引优化

已在迁移脚本中创建的索引：

- `user.email` (UNIQUE)
- `session.token` (UNIQUE)
- `user_courses.user_id`
- `user_video_notes.task_id`
- `key_actions.event_name`

### 查询优化

```sql
-- 使用 EXPLAIN 分析查询
EXPLAIN SELECT * FROM user_courses WHERE user_id = 'xxx';

-- 检查索引使用情况
SHOW INDEX FROM user_courses;
```

---

## ❓ 常见问题

### Q1: 迁移后数据丢失了？

**A:** 检查迁移日志，确认是否所有表都成功迁移。如果有失败，可以单独重新迁移该表：

```bash
# 修改 migrate-to-mysql.ts，只迁移指定表
const tables = ['user_video_notes']; // 只迁移这个表
```

### Q2: 连接池耗尽错误？

**A:** 调整 MySQL 连接池配置：

```typescript
// src/db/index.mysql.ts
connectionLimit: 3, // 增加连接数
maxIdle: 2,
```

### Q3: JSON 字段查询报错？

**A:** MySQL JSON 查询语法不同于 PostgreSQL，需要使用 `JSON_EXTRACT()` 函数。

### Q4: 时区问题导致时间不一致？

**A:** 确保 MySQL 连接配置了时区：

```typescript
timezone: '+00:00', // UTC
// 或
timezone: '+08:00', // 北京时间
```

### Q5: 如何验证数据完全一致？

**A:** 使用数据对比脚本：

```bash
# 导出 Supabase 数据
pg_dump --data-only > supabase-data.sql

# 导出 MySQL 数据
mysqldump --no-create-info > mysql-data.sql

# 对比记录数
diff supabase-data.sql mysql-data.sql
```

---

## 🎯 后续工作

迁移完成后的优化建议：

1. **监控数据库性能**
   - 设置慢查询日志
   - 监控连接数使用情况
   - 定期分析查询性能

2. **数据备份策略**
   - 配置 MySQL 自动备份
   - 设置备份保留周期
   - 测试备份恢复流程

3. **清理 Supabase**
   - 确认迁移成功后
   - 导出最终备份
   - 关闭 Supabase 项目（可选）

4. **文档更新**
   - 更新部署文档
   - 更新开发环境配置说明
   - 更新 README.md

---

## 📚 相关文档

- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [Drizzle ORM - MySQL](https://orm.drizzle.team/docs/get-started-mysql)
- [数据库连接池优化](./database-connection-pool-explained.md)
- [LearnOrbit 数据库架构](./database-architecture.md)

---

## ✅ 迁移检查清单

完成迁移后，请确认以下项目：

- [ ] MySQL 表结构已创建
- [ ] 所有数据已迁移（11 个表）
- [ ] 应用代码已切换到 MySQL
- [ ] 环境变量已更新
- [ ] 功能测试全部通过
- [ ] 性能测试符合预期
- [ ] Supabase 数据已备份
- [ ] 回滚方案已测试
- [ ] 文档已更新
- [ ] 团队成员已通知

---

**迁移完成日期**：____________

**迁移负责人**：____________

**验证通过**：□ 是  □ 否

---

*文档版本：v1.0*  
*最后更新：2024-12-25*


