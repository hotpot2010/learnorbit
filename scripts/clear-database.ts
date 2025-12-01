#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { userCourses } from '../src/db/schema';

async function clearDatabase() {
  try {
    console.log('🗑️ 开始清理数据库...');
    
    const db = await getDb();
    
    // 清理用户课程（任务数据现在存储在 userCourses.coursePlan.tasks 中，会随课程一起删除）
    const deletedCourses = await db.delete(userCourses);
    console.log('✅ 清理用户课程:', deletedCourses);
    
    console.log('🎉 数据库清理完成！');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库清理失败:', error);
    process.exit(1);
  }
}

clearDatabase(); 