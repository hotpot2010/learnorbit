#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { userCourses, courseTasks, courseChatHistory } from '../src/db/schema';

async function clearDatabase() {
  try {
    console.log('🗑️ 开始清理数据库...');
    
    const db = await getDb();
    
    // 清理聊天记录
    const deletedChatHistory = await db.delete(courseChatHistory);
    console.log('✅ 清理聊天记录:', deletedChatHistory);
    
    // 清理课程任务
    const deletedTasks = await db.delete(courseTasks);
    console.log('✅ 清理课程任务:', deletedTasks);
    
    // 清理用户课程
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