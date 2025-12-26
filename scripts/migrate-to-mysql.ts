/**
 * 数据迁移脚本：从 Supabase (PostgreSQL) 迁移到 MySQL
 * 
 * 使用方法:
 * 1. 确保在 .env 中配置了两个数据库的连接字符串:
 *    - SUPABASE_DATABASE_URL: Supabase PostgreSQL 连接
 *    - MYSQL_DATABASE_URL: MySQL 连接
 * 
 * 2. 运行迁移:
 *    npx tsx scripts/migrate-to-mysql.ts
 */

import postgres from 'postgres';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

// 表迁移顺序（考虑外键依赖）
// 注意: MySQL 表使用 learnorbit_ 前缀
const tables = [
  { pg: 'user', mysql: 'learnorbit_user' },
  { pg: 'session', mysql: 'learnorbit_session' },
  { pg: 'account', mysql: 'learnorbit_account' },
  { pg: 'verification', mysql: 'learnorbit_verification' },
  { pg: 'payment', mysql: 'learnorbit_payment' },
  { pg: 'user_courses', mysql: 'learnorbit_user_courses' },
  { pg: 'creator_courses', mysql: 'learnorbit_creator_courses' },
  { pg: 'key_actions', mysql: 'learnorbit_key_actions' },
  { pg: 'user_video_notes', mysql: 'learnorbit_user_video_notes' },
  { pg: 'video_note_tags', mysql: 'learnorbit_video_note_tags' },
  { pg: 'video_note_tag_relations', mysql: 'learnorbit_video_note_tag_relations' },
];

/**
 * 转换 PostgreSQL 值为 MySQL 兼容格式
 */
function convertValue(value: any, columnName: string): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  // JSON/JSONB 字段处理
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  
  // 数组转 JSON
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  
  // 布尔值转换
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  // 日期时间处理
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  
  return value;
}

/**
 * 迁移单个表
 */
async function migrateTable(
  tableConfig: { pg: string; mysql: string },
  pgClient: any,
  mysqlConnection: any
): Promise<void> {
  const { pg: pgTableName, mysql: mysqlTableName } = tableConfig;
  console.log(`\n📦 开始迁移表: ${pgTableName} → ${mysqlTableName}`);
  
  try {
    // 1. 从 PostgreSQL 读取数据
    const rows = await pgClient`SELECT * FROM ${pgClient(pgTableName)}`;
    
    if (rows.length === 0) {
      console.log(`   ℹ️  表 ${pgTableName} 无数据，跳过`);
      return;
    }
    
    console.log(`   📊 读取到 ${rows.length} 条记录`);
    
    // 2. 清空 MySQL 目标表（可选，根据需求决定）
    await mysqlConnection.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await mysqlConnection.query(`TRUNCATE TABLE \`${mysqlTableName}\``);
    await mysqlConnection.query(`SET FOREIGN_KEY_CHECKS = 1`);
    
    // 3. 批量插入数据
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of rows) {
      try {
        // 获取列名和值
        const columns = Object.keys(row);
        const values = columns.map(col => convertValue(row[col], col));
        
        // 构建 INSERT 语句
        const placeholders = columns.map(() => '?').join(', ');
        const columnNames = columns.map(col => `\`${col}\``).join(', ');
        
        const query = `INSERT INTO \`${mysqlTableName}\` (${columnNames}) VALUES (${placeholders})`;
        
        await mysqlConnection.query(query, values);
        successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ 插入失败 (ID: ${row.id}):`, error.message);
      }
    }
    
    console.log(`   ✅ 成功: ${successCount} 条`);
    if (errorCount > 0) {
      console.log(`   ⚠️  失败: ${errorCount} 条`);
    }
  } catch (error: any) {
    console.error(`   ❌ 迁移表 ${pgTableName} → ${mysqlTableName} 失败:`, error.message);
    throw error;
  }
}

/**
 * 主迁移流程
 */
async function main() {
  // PostgreSQL 连接
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_DATABASE_URL not set');
  }

  // MySQL 连接
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!mysqlUrl) {
    throw new Error('MYSQL_DATABASE_URL or DATABASE_URL not set');
  }

  const pgClient = postgres(supabaseUrl);
  const mysqlConnection = await mysql.createConnection(mysqlUrl);

  console.log('🚀 开始数据库迁移: Supabase → MySQL');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailed = 0;
  
  try {
    // 测试连接
    console.log('\n🔗 测试数据库连接...');
    await pgClient`SELECT 1`;
    await mysqlConnection.ping();
    console.log('   ✅ PostgreSQL 连接成功');
    console.log('   ✅ MySQL 连接成功');
    
    // 按顺序迁移每个表
    for (const table of tables) {
      try {
        await migrateTable(table, pgClient, mysqlConnection);
        totalSuccess++;
      } catch (error) {
        totalFailed++;
        console.error(`\n❌ 表 ${table.pg} → ${table.mysql} 迁移失败，继续下一个表...`);
      }
    }
    
    // 总结
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移完成统计:');
    console.log(`   ✅ 成功: ${totalSuccess} 个表`);
    console.log(`   ❌ 失败: ${totalFailed} 个表`);
    console.log(`   ⏱️  耗时: ${duration} 秒`);
    console.log('='.repeat(60));
    
    if (totalFailed === 0) {
      console.log('\n🎉 所有表迁移成功！');
    } else {
      console.log('\n⚠️  部分表迁移失败，请检查错误信息');
    }
  } catch (error: any) {
    console.error('\n❌ 迁移过程发生致命错误:', error.message);
    process.exit(1);
  } finally {
    // 关闭连接
    try {
      await pgClient.end();
    } catch (e) {
      // 忽略
    }
    try {
      await mysqlConnection.end();
    } catch (e) {
      // 忽略
    }
  }
}

// 执行迁移
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

