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

  // 连接健康检查函数
async function checkConnection(client: ReturnType<typeof postgres>): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error: any) {
    // 检查是否是连接关闭/终止错误
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';
    const errorString = String(error).toLowerCase();
    
    if (
      errorCode === 'CONNECTION_CLOSED' || 
      errorCode === 'CONNECTION_ENDED' ||
      errorMessage.includes('CONNECTION_CLOSED') ||
      errorMessage.includes('CONNECTION_ENDED') ||
      errorString.includes('connection_closed') ||
      errorString.includes('connection_ended')
    ) {
      return false;
    }
    // 其他错误也认为连接不可用
    return false;
  }
}

export async function getDb() {
  // 如果已有连接，先检查连接是否健康
  if (db && client) {
    try {
      const isHealthy = await checkConnection(client);
      if (isHealthy) {
        return db;
      } else {
        // 连接已关闭，清理并重新创建
        console.log('⚠️ Database connection closed, recreating...');
        try {
          await client.end({ timeout: 5 });
        } catch (e) {
          // 忽略清理错误
        }
        db = null;
        client = null;
      }
    } catch (error: any) {
      // 检查连接时出错，可能是连接已终止
      const errorCode = error?.code || '';
      const errorMessage = error?.message || '';
      if (
        errorCode === 'CONNECTION_ENDED' || 
        errorCode === 'CONNECTION_CLOSED' ||
        errorMessage.includes('CONNECTION_ENDED') ||
        errorMessage.includes('CONNECTION_CLOSED')
      ) {
        console.log('⚠️ Database connection ended, recreating...');
        try {
          if (client) {
            await client.end({ timeout: 5 });
          }
        } catch (e) {
          // 忽略清理错误
        }
        db = null;
        client = null;
      } else {
        // 其他错误，重新抛出
        throw error;
      }
    }
  }

  let connectionString = process.env.DATABASE_URL!;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Supabase 连接配置优化
  // Supabase pooler 使用 :6543 (transaction mode) 或 :5432 (session mode)
  // 我们优先使用 session mode (:5432) 以获得更好的连接稳定性
  const isPooler = connectionString.includes('pooler.supabase.com');
  if (isPooler && connectionString.includes(':6543')) {
    // 如果使用 transaction mode pooler，切换到 session mode pooler
    connectionString = connectionString.replace(':6543', ':5432');
    console.log('🔄 Using session mode pooler instead of transaction mode');
  }

  // 配置postgres客户端 - 针对 Serverless 环境优化
  client = postgres(connectionString, {
    prepare: false,
    // 连接配置 - Serverless 环境每个实例只需1个连接
    max: 1, // ✅ Serverless: 每个实例1个连接足够（避免连接池耗尽）
    idle_timeout: 20, // ✅ 20秒空闲超时（快速释放连接）
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
      max: 3, // 开发环境稍多一些连接
      idle_timeout: 30,
      max_lifetime: 60 * 30, // 30分钟生命周期
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
        try {
          client.end();
        } catch (e) {
          // 忽略清理错误
        }
        client = null;
      }

      client = postgres(poolerConnectionString, {
        prepare: false,
        max: 1, // ✅ pooler模式：每个实例1个连接
        idle_timeout: 20,
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
        // 清理失败的连接
        db = null;
        client = null;
        throw fallbackError;
      }
    }

    // 清理失败的连接
    db = null;
    client = null;
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
