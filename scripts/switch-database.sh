#!/bin/bash

# 数据库切换脚本
# 用于在 PostgreSQL (Supabase) 和 MySQL 之间切换

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==============================================\033[0m"
echo -e "${GREEN}LearnOrbit 数据库切换工具${NC}"
echo -e "${GREEN}==============================================\033[0m"
echo ""

# 检查参数
if [ -z "$1" ]; then
  echo -e "${RED}错误: 请指定数据库类型${NC}"
  echo ""
  echo "用法:"
  echo "  ./scripts/switch-database.sh postgres   # 切换到 PostgreSQL (Supabase)"
  echo "  ./scripts/switch-database.sh mysql      # 切换到 MySQL"
  echo ""
  exit 1
fi

DB_TYPE=$1

if [ "$DB_TYPE" != "postgres" ] && [ "$DB_TYPE" != "mysql" ]; then
  echo -e "${RED}错误: 数据库类型只能是 'postgres' 或 'mysql'${NC}"
  exit 1
fi

echo -e "${YELLOW}📝 准备切换到: ${DB_TYPE}${NC}"
echo ""

# 备份当前配置
BACKUP_DIR="backups/db-config-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}💾 备份当前配置到: ${BACKUP_DIR}${NC}"
cp src/db/index.ts "$BACKUP_DIR/index.ts" 2>/dev/null || true
cp src/db/schema.ts "$BACKUP_DIR/schema.ts" 2>/dev/null || true

if [ "$DB_TYPE" = "mysql" ]; then
  echo ""
  echo -e "${GREEN}🔄 切换到 MySQL...${NC}"
  
  # 1. 替换数据库连接文件
  if [ -f "src/db/index.mysql.ts" ]; then
    cp src/db/index.mysql.ts src/db/index.ts
    echo "   ✅ 已更新 src/db/index.ts"
  else
    echo -e "   ${RED}❌ 找不到 src/db/index.mysql.ts${NC}"
    exit 1
  fi
  
  # 2. 替换 schema 文件
  if [ -f "src/db/schema.mysql.ts" ]; then
    cp src/db/schema.mysql.ts src/db/schema.ts
    echo "   ✅ 已更新 src/db/schema.ts"
  else
    echo -e "   ${RED}❌ 找不到 src/db/schema.mysql.ts${NC}"
    exit 1
  fi
  
  # 3. 更新 auth.ts 中的 provider 配置
  if [ -f "src/lib/auth.ts" ]; then
    # 使用 sed 替换 provider: 'pg' 为 provider: 'mysql'
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s/provider: 'pg'/provider: 'mysql'/g" src/lib/auth.ts
    else
      # Linux
      sed -i "s/provider: 'pg'/provider: 'mysql'/g" src/lib/auth.ts
    fi
    echo "   ✅ 已更新 src/lib/auth.ts (provider: mysql)"
  fi
  
  echo ""
  echo -e "${GREEN}✅ 已切换到 MySQL${NC}"
  echo ""
  echo -e "${YELLOW}📌 下一步:${NC}"
  echo "   1. 确保 .env 中的 DATABASE_URL 指向 MySQL"
  echo "      格式: mysql://user:password@host:port/database"
  echo ""
  echo "   2. 运行 MySQL 迁移脚本创建表结构:"
  echo "      mysql -u user -p database < migrations/mysql/001_initial_schema.sql"
  echo ""
  echo "   3. (可选) 从 Supabase 迁移数据:"
  echo "      SUPABASE_DATABASE_URL=xxx MYSQL_DATABASE_URL=xxx npx tsx scripts/migrate-to-mysql.ts"
  echo ""
  
elif [ "$DB_TYPE" = "postgres" ]; then
  echo ""
  echo -e "${GREEN}🔄 切换回 PostgreSQL (Supabase)...${NC}"
  
  # 恢复 PostgreSQL 配置
  if [ -f "src/db/index.postgres.ts" ]; then
    cp src/db/index.postgres.ts src/db/index.ts
    echo "   ✅ 已恢复 src/db/index.ts"
  elif [ -f "$BACKUP_DIR/index.ts" ]; then
    cp "$BACKUP_DIR/index.ts" src/db/index.ts
    echo "   ✅ 从备份恢复 src/db/index.ts"
  else
    echo -e "   ${RED}❌ 找不到 PostgreSQL 配置文件${NC}"
    exit 1
  fi
  
  # 恢复 schema
  if [ -f "src/db/schema.postgres.ts" ]; then
    cp src/db/schema.postgres.ts src/db/schema.ts
    echo "   ✅ 已恢复 src/db/schema.ts"
  elif [ -f "$BACKUP_DIR/schema.ts" ]; then
    cp "$BACKUP_DIR/schema.ts" src/db/schema.ts
    echo "   ✅ 从备份恢复 src/db/schema.ts"
  else
    echo -e "   ${RED}❌ 找不到 PostgreSQL schema 文件${NC}"
    exit 1
  fi
  
  # 恢复 auth.ts
  if [ -f "src/lib/auth.ts" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/provider: 'mysql'/provider: 'pg'/g" src/lib/auth.ts
    else
      sed -i "s/provider: 'mysql'/provider: 'pg'/g" src/lib/auth.ts
    fi
    echo "   ✅ 已恢复 src/lib/auth.ts (provider: pg)"
  fi
  
  echo ""
  echo -e "${GREEN}✅ 已切换回 PostgreSQL${NC}"
  echo ""
  echo -e "${YELLOW}📌 确保 .env 中的 DATABASE_URL 指向 Supabase:${NC}"
  echo "   格式: postgresql://user:password@db.xxx.supabase.co:5432/postgres"
  echo ""
fi

echo -e "${GREEN}==============================================\033[0m"
echo -e "${GREEN}完成！${NC}"
echo -e "${GREEN}==============================================\033[0m"


