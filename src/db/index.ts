/**
 * Connect to PostgreSQL Database (Supabase/Neon/Local PostgreSQL)
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;

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

  // 配置postgres客户端
  const client = postgres(connectionString, {
    prepare: false,
    // 连接配置 - 更保守的设置
    max: 10, // 减少最大连接数
    idle_timeout: 20, // 20秒空闲超时
    connect_timeout: 15, // 15秒连接超时
    max_lifetime: 60 * 30, // 30分钟连接生命周期
    // SSL配置
    ssl: { rejectUnauthorized: false },
    // 错误处理
    onnotice: () => {}, // 忽略notice
    debug: false, // 关闭调试日志避免干扰
    transform: {
      undefined: null
    }
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

      const fallbackClient = postgres(poolerConnectionString, {
        prepare: false,
        max: 5,
        idle_timeout: 10,
        connect_timeout: 10,
        ssl: { rejectUnauthorized: false },
        onnotice: () => {},
        debug: false,
        transform: {
          undefined: null
        }
      });

      try {
        db = drizzle(fallbackClient, { schema });
        await fallbackClient`SELECT 1`;
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
