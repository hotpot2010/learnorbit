/**
 * Connect to PostgreSQL Database (Supabase/Neon/Local PostgreSQL)
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

// 全局连接清理函数
export function closeDb() {
  if (client) {
    console.log('🔄 Closing database connections');
    client.end();
    client = null;
    db = null;
  }
}

// 在进程退出时清理连接
if (typeof process !== 'undefined') {
  process.on('beforeExit', closeDb);
  process.on('SIGINT', closeDb);
  process.on('SIGTERM', closeDb);
}

export async function getDb() {
  if (db) return db;

  let connectionString = process.env.DATABASE_URL!;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // 如果是Supabase连接池URL，尝试使用直连端口
  if (connectionString.includes('pooler.supabase.com:6543')) {
    connectionString = connectionString.replace(':6543', ':5432');
    console.log('🔄 Using direct connection instead of pooler');
  }

  // 配置postgres客户端 - 修复连接泄漏
  client = postgres(connectionString, {
    prepare: false,
    // 连接配置 - 更严格的限制防止连接泄漏
    max: 5, // 严格限制最大连接数
    idle_timeout: 10, // 10秒空闲超时，快速释放
    connect_timeout: 10, // 10秒连接超时
    max_lifetime: 60 * 10, // 10分钟连接生命周期，频繁刷新
    // SSL配置
    ssl: { rejectUnauthorized: false },
    // 错误处理
    onnotice: () => {}, // 忽略notice
    debug: false, // 关闭调试日志避免干扰
    transform: {
      undefined: null
    },
    // 开发环境特殊配置
    ...(process.env.NODE_ENV === 'development' && {
      max: 3, // 开发环境更严格限制
      idle_timeout: 5, // 更快释放
      max_lifetime: 60 * 5, // 5分钟生命周期
    })
  });

  try {
    db = drizzle(client, { schema });

    // 测试连接
    await client`SELECT 1`;
    console.log('✅ Database connection established');
    return db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);

    // 如果直连失败，回退到pooler
    if (connectionString.includes(':5432')) {
      console.log('🔄 Fallback to pooler connection');
      const poolerConnectionString = connectionString.replace(':5432', ':6543');

      // 先清理之前的客户端
      if (client) {
        client.end();
        client = null;
      }

      client = postgres(poolerConnectionString, {
        prepare: false,
        max: 3, // pooler连接更严格限制
        idle_timeout: 5,
        connect_timeout: 10,
        max_lifetime: 60 * 5,
        ssl: { rejectUnauthorized: false },
        onnotice: () => {},
        debug: false,
        transform: {
          undefined: null
        }
      });

      try {
        db = drizzle(client, { schema });
        await client`SELECT 1`;
        console.log('✅ Fallback database connection established');
        return db;
      } catch (fallbackError) {
        console.error('❌ Fallback connection also failed:', fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Connect to Neon Database
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-neon
 */
// import { drizzle } from 'drizzle-orm/neon-http';
// const db = drizzle(process.env.DATABASE_URL!);

/**
 * Database connection with Drizzle
 * https://orm.drizzle.team/docs/connect-overview
 *
 * Drizzle <> PostgreSQL
 * https://orm.drizzle.team/docs/get-started-postgresql
 *
 * Get Started with Drizzle and Neon
 * https://orm.drizzle.team/docs/get-started/neon-new
 *
 * Drizzle with Neon Postgres
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-neon
 *
 * Drizzle <> Neon Postgres
 * https://orm.drizzle.team/docs/connect-neon
 *
 * Drizzle with Supabase Database
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
 */
