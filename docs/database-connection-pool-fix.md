# 数据库连接池耗尽问题修复方案

## 🚨 问题描述

生产环境出现大量 `Max client connections reached` 错误：

```
Error: Max client connections reached
severity: 'FATAL'
code: 'XX000'
page: '/api/auth/get-session'
```

**影响范围：**
- 登录失败 (`/api/auth/sign-in/email`)
- 会话获取失败 (`/api/auth/get-session`)
- 所有需要数据库的API请求失败

## 🔍 根本原因分析

### 当前配置问题

**文件：** `src/db/index.ts`（第120-142行）

```typescript
client = postgres(connectionString, {
  prepare: false,
  max: 5, // ❌ 生产环境只有5个连接
  idle_timeout: 30,
  connect_timeout: 15,
  max_lifetime: 60 * 60,
  // ...
  ...(process.env.NODE_ENV === 'development' && {
    max: 3, // ❌ 开发环境只有3个连接
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  })
});
```

### 问题原因

1. **连接池太小**
   - 生产环境：max = 5
   - Vercel Serverless 函数可能有多个并发实例
   - 每个实例都会创建连接池
   - 5个连接在高并发下很容易耗尽

2. **Serverless 架构特性**
   - 每个Serverless函数实例都是独立的
   - 每个实例都会创建自己的数据库连接池
   - 多个实例同时运行时，总连接数 = 实例数 × max
   - 如果有10个实例，就是 10 × 5 = 50个连接

3. **可能的连接泄漏**
   - 连接可能没有正确释放
   - 长时间运行的查询占用连接
   - 错误处理不当导致连接未关闭

## ✅ 解决方案

### 方案1：增加连接池大小（推荐）

修改 `src/db/index.ts`：

```typescript
// 配置postgres客户端 - 优化连接稳定性
client = postgres(connectionString, {
  prepare: false,
  // 连接配置 - 针对 Serverless 优化
  max: 1, // ✅ Serverless环境：每个实例只用1个连接
  idle_timeout: 20, // ✅ 20秒空闲超时（Serverless快速释放）
  connect_timeout: 10, // ✅ 10秒连接超时
  max_lifetime: 60 * 5, // ✅ 5分钟连接生命周期（Serverless短生命周期）
  // SSL配置
  ssl: { rejectUnauthorized: false },
  // 错误处理
  onnotice: () => {}, // 忽略notice
  debug: false, // 关闭调试日志避免干扰
  transform: {
    undefined: null
  },
  // 连接错误重试配置
  connection: {
    // 自动重连配置
    application_name: 'learnorbit-app',
  },
  // 开发环境特殊配置
  ...(process.env.NODE_ENV === 'development' && {
    max: 3, // 开发环境稍多一些
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  })
});
```

**为什么用 max: 1？**

在Serverless环境（如Vercel）中：
- 每个函数调用都是短暂的
- 每个实例只处理一个请求
- 多个连接会浪费，且增加总连接数
- 1个连接足够单个请求使用

### 方案2：使用连接池 Pooler（推荐同时使用）

**使用 Supabase/Neon 的 Transaction Mode Pooler：**

```bash
# 原连接字符串（Session Mode）
DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:5432/postgres

# 改为 Transaction Mode Pooler
DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres
```

**优势：**
- Pooler 会复用连接
- 支持更多并发
- 减轻数据库压力

### 方案3：检查并修复连接泄漏

#### 3.1 确保所有查询使用连接池

```typescript
// ❌ 错误：直接创建新连接
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL!);

// ✅ 正确：使用全局连接池
import { getDb } from '@/db';
const db = await getDb();
```

#### 3.2 确保错误时也释放连接

```typescript
// ✅ 使用 try-finally 确保连接释放
export async function handler(req: Request) {
  try {
    const db = await getDb();
    const result = await db.query.users.findMany();
    return result;
  } catch (error) {
    console.error('Query failed:', error);
    throw error;
  }
  // Drizzle ORM 会自动管理连接，无需手动释放
}
```

## 🔧 具体实施步骤

### 步骤1：修改连接池配置

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">src/db/index.ts
