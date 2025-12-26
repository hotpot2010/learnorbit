/**
 * MySQL 数据库连接配置
 * 替代原来的 PostgreSQL (Supabase) 连接
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.mysql';

let db: ReturnType<typeof drizzle> | null = null;
let pool: mysql.Pool | null = null;

// 全局连接清理函数
export function closeDb() {
  if (pool) {
    console.log('🔄 Closing MySQL database connections');
    pool.end();
    pool = null;
    db = null;
  }
}

// 在进程退出时清理连接
if (typeof process !== 'undefined') {
  process.on('SIGINT', closeDb);
  process.on('SIGTERM', closeDb);
  process.on('exit', closeDb);
}

/**
 * 获取 MySQL 数据库连接
 */
export async function getDb() {
  // 如果已有连接，直接返回
  if (db && pool) {
    try {
      // 测试连接是否健康
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      return db;
    } catch (error) {
      console.log('⚠️ MySQL connection unhealthy, recreating...');
      closeDb();
    }
  }

  const connectionString = process.env.DATABASE_URL!;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // 解析 MySQL 连接字符串
  // 格式: mysql://user:password@host:port/database
  const url = new URL(connectionString);
  
  // 创建 MySQL 连接池
  pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // 移除开头的 '/'
    // 连接池配置 - 针对 Serverless 优化
    connectionLimit: process.env.NODE_ENV === 'production' ? 1 : 3,
    maxIdle: 1, // 最大空闲连接数
    idleTimeout: 20000, // 20秒空闲超时
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // 字符集配置
    charset: 'utf8mb4',
    // 时区配置
    timezone: '+00:00',
    // 连接属性
    connectTimeout: 10000, // 10秒连接超时
    // SSL 配置（如果需要）
    ssl: url.searchParams.get('ssl') === 'true' ? {
      rejectUnauthorized: false
    } : undefined,
  });

  try {
    // 测试连接
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();

    // 创建 Drizzle 实例
    db = drizzle(pool, { 
      schema,
      mode: 'default',
    });

    console.log('✅ MySQL database connection established');
    console.log(`📊 Database: ${url.pathname.slice(1)}`);
    console.log(`🔗 Host: ${url.hostname}:${url.port || 3306}`);
    console.log(`⚙️  Pool limit: ${process.env.NODE_ENV === 'production' ? 1 : 3}`);

    return db;
  } catch (error) {
    console.error('❌ MySQL database connection failed:', error);
    closeDb();
    throw error;
  }
}

/**
 * 获取原始 MySQL 连接池（用于特殊场景）
 */
export async function getPool() {
  if (!pool) {
    await getDb(); // 确保连接池已初始化
  }
  return pool!;
}

/**
 * 执行数据库健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    if (!pool) {
      await getDb();
    }
    const connection = await pool!.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL health check failed:', error);
    return false;
  }
}


