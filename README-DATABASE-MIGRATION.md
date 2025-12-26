# 🗄️ 数据库迁移说明

## 快速开始

LearnOrbit 项目现在支持两种数据库配置：

1. **PostgreSQL (Supabase)** - 原始配置
2. **MySQL (阿里云 RDS)** - 新配置（推荐）

## 📦 迁移到 MySQL

### 一键迁移

```bash
# 1. 创建 MySQL 表结构
mysql -u user -p database < migrations/mysql/001_initial_schema.sql

# 2. 迁移数据（可选）
SUPABASE_DATABASE_URL=xxx MYSQL_DATABASE_URL=xxx npx tsx scripts/migrate-to-mysql.ts

# 3. 切换应用到 MySQL
./scripts/switch-database.sh mysql

# 4. 更新环境变量
# 将 DATABASE_URL 改为 MySQL 连接字符串
```

### 环境变量配置

```bash
# MySQL 配置（推荐）
DATABASE_URL="mysql://user:password@host:3306/database"

# 或使用已有的后端 MySQL
DATABASE_URL="mysql://gt_ai_writing_rw:xxx@gaotu-polar-test03.rwlb.rds.aliyuncs.com:3306/gt_ai_writing"
```

## 🔄 切换数据库

### 切换到 MySQL

```bash
./scripts/switch-database.sh mysql
```

### 切换回 PostgreSQL

```bash
./scripts/switch-database.sh postgres
```

## 📁 相关文件

- `migrations/mysql/001_initial_schema.sql` - MySQL 建表脚本
- `src/db/schema.mysql.ts` - MySQL Schema 定义
- `src/db/index.mysql.ts` - MySQL 连接配置
- `scripts/migrate-to-mysql.ts` - 数据迁移工具
- `scripts/switch-database.sh` - 数据库切换工具

## 📖 详细文档

完整的迁移指南请查看：[docs/database-migration-to-mysql.md](./docs/database-migration-to-mysql.md)

## ❓ 常见问题

### Q: 为什么要迁移到 MySQL？

A: 
- 统一技术栈（后端已使用 MySQL）
- 降低成本（使用同一个数据库实例）
- 简化运维（只需管理一种数据库）
- 数据本地化（访问速度更快）

### Q: 迁移会丢失数据吗？

A: 不会。迁移脚本会：
1. 自动备份当前配置
2. 从 Supabase 导出所有数据
3. 导入到 MySQL
4. 保留 Supabase 数据不删除

### Q: 如果迁移失败怎么办？

A: 可以快速回滚：
```bash
./scripts/switch-database.sh postgres
```

### Q: 需要修改代码吗？

A: 不需要。切换脚本会自动：
- 替换数据库连接文件
- 更新 Schema 定义
- 修改 Auth 配置

## 🎯 数据库架构对比

| 项目 | Supabase (旧) | MySQL (新) |
|------|--------------|-----------|
| 数据库类型 | PostgreSQL | MySQL 8.0 |
| 位置 | 国外 | 国内（阿里云） |
| ORM | Drizzle (postgres-js) | Drizzle (mysql2) |
| 连接池 | postgres.js | mysql2 |
| JSON 类型 | JSONB | JSON |
| 成本 | 独立计费 | 共享实例 |

## 📊 两个数据库使用情况

### Supabase (PostgreSQL)
- ✅ 用户认证数据
- ✅ 学习课程数据
- ✅ 用户行为分析
- ✅ **视频笔记**（通过 taskId 关联到 MySQL）

### MySQL (阿里云 RDS)
- ✅ 视频处理任务
- ✅ ASR 识别结果
- ✅ 知识点提取结果
- ✅ 练习题生成结果

### 迁移后（推荐）
- ✅ **所有数据统一存储在 MySQL**
- ✅ 简化架构，降低维护成本
- ✅ 提升国内访问速度

## 🚀 开始迁移

准备好了吗？查看完整迁移指南：

👉 [数据库迁移指南](./docs/database-migration-to-mysql.md)


