#!/usr/bin/env tsx

/**
 * 手动添加 plan_url 列到数据库
 * 
 * 使用方法：
 *   pnpm tsx scripts/add-plan-url-column.ts
 */

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('🔧 开始添加 plan_url 列...\n');

    const db = await getDb();
    console.log('✅ 数据库连接成功');

    // 执行 SQL 添加列
    console.log('📝 执行 SQL: ALTER TABLE "user_courses" ADD COLUMN IF NOT EXISTS "plan_url" TEXT');
    await db.execute(sql`ALTER TABLE "user_courses" ADD COLUMN IF NOT EXISTS "plan_url" TEXT`);

    console.log('✅ plan_url 列添加成功！\n');

    // 验证列是否存在
    const result: any[] = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_courses' AND column_name = 'plan_url'
    `) as any;

    if (result && result.length > 0) {
      console.log('✅ 验证成功：plan_url 列已存在');
      console.log(`   列名: ${result[0].column_name}`);
      console.log(`   类型: ${result[0].data_type}`);
    } else {
      console.log('⚠️  警告：未找到 plan_url 列，但 SQL 已执行');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 添加列失败:', error);
    process.exit(1);
  }
}

main();

