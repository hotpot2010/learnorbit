#!/usr/bin/env tsx

/**
 * 迁移脚本：将完整的 coursePlan（包含 plan、tasks、notes、marks）上传到 CDN
 * 
 * 功能：
 * 1. 扫描所有 user_courses 记录
 * 2. 对于已有 planUrl 的课程：
 *    - 从 CDN 下载现有的 plan 数据
 *    - 从数据库 coursePlan 字段读取 tasks、notes、marks
 *    - 合并成完整的 coursePlan 对象
 *    - 重新上传到 CDN
 * 3. 对于没有 planUrl 的课程：
 *    - 从数据库 coursePlan 字段读取完整数据
 *    - 上传到 CDN
 * 4. 更新数据库中的 planUrl 字段，并将 coursePlan 设为空对象
 * 
 * 使用方法：
 *   pnpm tsx scripts/migrate-full-course-plan-to-cdn.ts
 */

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { userCourses } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { uploadJsonToCDN, downloadJsonFromCDN } from '../src/lib/cdn-utils';

/**
 * 迁移单个课程的完整 coursePlan 到 CDN
 */
async function migrateFullCoursePlan(course: any): Promise<boolean> {
  try {
    const courseId = course.id;
    const coursePlan = course.coursePlan as any;

    // 构建完整的 coursePlan 对象
    let fullCoursePlan: any;

    if (course.planUrl) {
      // 情况1：已有 planUrl，需要合并数据
      console.log(`\n📋 处理课程 ${courseId}（已有 planUrl，需要合并）`);
      
      try {
        // 从 CDN 下载现有的 plan 数据
        const planData = await downloadJsonFromCDN(course.planUrl);
        console.log(`   ✅ 从 CDN 下载 plan 数据成功`);
        
        // 从数据库 coursePlan 字段读取 tasks、notes、marks
        const tasks = coursePlan?.tasks || {};
        const notes = coursePlan?.notes || [];
        const marks = coursePlan?.marks || [];
        const isPublic = coursePlan?.isPublic;
        
        // 合并成完整的 coursePlan 对象
        fullCoursePlan = {
          plan: planData, // 从 CDN 下载的 plan 数据
          tasks: tasks,
          notes: notes,
          marks: marks,
        };
        
        // 如果有 isPublic，也包含进去
        if (isPublic !== undefined) {
          fullCoursePlan.isPublic = isPublic;
        }
        
        console.log(`   📊 合并后的数据:`, {
          hasPlan: !!fullCoursePlan.plan,
          tasksCount: Object.keys(fullCoursePlan.tasks || {}).length,
          notesCount: (fullCoursePlan.notes || []).length,
          marksCount: (fullCoursePlan.marks || []).length,
          hasIsPublic: fullCoursePlan.isPublic !== undefined,
        });
      } catch (error) {
        console.error(`   ❌ 从 CDN 下载 plan 数据失败:`, error);
        // 如果下载失败，尝试从数据库 coursePlan 读取完整数据
        console.log(`   ⚠️  回退到数据库数据`);
        fullCoursePlan = coursePlan;
      }
    } else {
      // 情况2：没有 planUrl，从数据库 coursePlan 字段读取完整数据
      console.log(`\n📋 处理课程 ${courseId}（没有 planUrl，从数据库读取）`);
      
      if (!coursePlan || Object.keys(coursePlan).length === 0) {
        console.log(`   ⏭️  课程 ${courseId} 没有 coursePlan 数据，跳过`);
        return false;
      }
      
      // 确保 coursePlan 有正确的结构
      fullCoursePlan = {
        plan: coursePlan.plan || coursePlan, // 兼容旧格式
        tasks: coursePlan.tasks || {},
        notes: coursePlan.notes || [],
        marks: coursePlan.marks || [],
      };
      
      // 如果有 isPublic，也包含进去
      if (coursePlan.isPublic !== undefined) {
        fullCoursePlan.isPublic = coursePlan.isPublic;
      }
      
      console.log(`   📊 数据库中的数据:`, {
        hasPlan: !!fullCoursePlan.plan,
        tasksCount: Object.keys(fullCoursePlan.tasks || {}).length,
        notesCount: (fullCoursePlan.notes || []).length,
        marksCount: (fullCoursePlan.marks || []).length,
        hasIsPublic: fullCoursePlan.isPublic !== undefined,
      });
    }

    // 序列化为 JSON
    const jsonContent = JSON.stringify(fullCoursePlan, null, 2);
    const jsonSize = Buffer.byteLength(jsonContent, 'utf-8');
    
    console.log(`   📦 数据大小: ${jsonSize} bytes (${(jsonSize / 1024).toFixed(2)} KB)`);

    // 生成文件名
    const filename = `course_plan_${courseId}_${Date.now()}.json`;

    // 上传到 CDN
    const planUrl = await uploadJsonToCDN(jsonContent, filename);
    console.log(`   ✅ 上传成功，CDN URL: ${planUrl}`);

    // 更新数据库
    const db = await getDb();

    console.log(`   💾 更新数据库: courseId=${courseId}, planUrl=${planUrl}`);

    const [updatedCourse] = await db
      .update(userCourses)
      .set({
        planUrl: planUrl, // 更新 planUrl
        coursePlan: {}, // 清空 coursePlan，所有数据都在 CDN
        updatedAt: new Date(),
      })
      .where(eq(userCourses.id, courseId))
      .returning();

    if (!updatedCourse) {
      throw new Error(`数据库更新失败：未找到课程 ${courseId}`);
    }

    // 验证更新是否成功
    if (!updatedCourse.planUrl) {
      throw new Error(`数据库更新失败：planUrl 未写入，实际值: ${updatedCourse.planUrl}`);
    }

    console.log(`   ✅ 课程 ${courseId} 迁移成功`);
    return true;
  } catch (error) {
    console.error(`   ❌ 课程 ${course.id} 迁移失败:`, error);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始迁移完整的 coursePlan 到 CDN...');
    console.log(`📍 CDN 工具函数已导入\n`);

    const db = await getDb();

    // 确保 plan_url 列存在
    try {
      console.log('🔧 检查 plan_url 列是否存在...');
      await db.execute(sql`ALTER TABLE "user_courses" ADD COLUMN IF NOT EXISTS "plan_url" TEXT`);
      console.log('✅ plan_url 列已就绪\n');
    } catch (error: any) {
      // 如果列已存在，忽略错误
      if (error?.code !== '42703') {
        console.log('⚠️  添加列时出现警告（可能已存在）:', error.message);
      }
    }

    // 获取所有课程
    const allCourses = await db.select().from(userCourses);
    console.log(`📊 找到 ${allCourses.length} 个课程\n`);

    if (allCourses.length === 0) {
      console.log('✅ 没有需要迁移的课程');
      process.exit(0);
    }

    // 统计信息
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 逐个迁移
    for (let i = 0; i < allCourses.length; i++) {
      const course = allCourses[i];
      console.log(`\n[${i + 1}/${allCourses.length}] 处理课程: ${course.id}`);
      
      try {
        const migrated = await migrateFullCoursePlan(course);
        if (migrated) {
          successCount++;
        } else {
          skipCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ 处理失败:`, error);
      }

      // 添加延迟，避免请求过快
      if (i < allCourses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 输出统计信息
    console.log('\n' + '='.repeat(50));
    console.log('📊 迁移统计:');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ⏭️  跳过: ${skipCount}`);
    console.log(`   ❌ 失败: ${errorCount}`);
    console.log(`   📦 总计: ${allCourses.length}`);
    console.log('='.repeat(50));

    console.log('\n🎉 迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
    process.exit(1);
  }
}

// 运行主函数
main();

