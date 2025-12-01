#!/usr/bin/env tsx

/**
 * 验证脚本：检查 coursePlan.planUrl 是否正确写入数据库
 * 
 * 使用方法：
 *   pnpm tsx scripts/verify-course-plan-url.ts
 */

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { userCourses } from '../src/db/schema';

async function main() {
  try {
    console.log('🔍 开始验证 coursePlan.planUrl...\n');

    const db = await getDb();

    // 获取所有课程
    const allCourses = await db.select().from(userCourses);
    console.log(`📊 找到 ${allCourses.length} 个课程\n`);

    if (allCourses.length === 0) {
      console.log('✅ 没有课程数据');
      process.exit(0);
    }

    // 统计信息
    let hasPlanUrlCount = 0;
    let noPlanUrlCount = 0;
    let hasPlanDataCount = 0;
    let noPlanDataCount = 0;

    console.log('='.repeat(80));
    console.log('课程详情：');
    console.log('='.repeat(80));

    for (let i = 0; i < allCourses.length; i++) {
      const course = allCourses[i];
      const coursePlan = course.coursePlan as any;

      console.log(`\n[${i + 1}/${allCourses.length}] 课程 ID: ${course.id}`);
      console.log(`   用户 ID: ${course.userId}`);
      console.log(`   创建时间: ${course.createdAt}`);
      console.log(`   更新时间: ${course.updatedAt}`);

      // 检查 planUrl（现在是独立列）
      if (course.planUrl) {
        hasPlanUrlCount++;
        console.log(`   ✅ planUrl (独立列): ${course.planUrl}`);
      } else {
        noPlanUrlCount++;
        console.log(`   ❌ planUrl (独立列): 不存在`);
      }

      // 也检查 JSONB 中是否有 planUrl（向后兼容）
      if (coursePlan?.planUrl) {
        console.log(`   ⚠️  注意：JSONB 中也有 planUrl: ${coursePlan.planUrl}（应该迁移到独立列）`);
      }

      // 检查 plan 数据
      if (coursePlan?.plan) {
        hasPlanDataCount++;
        const planSize = JSON.stringify(coursePlan.plan).length;
        console.log(`   📋 plan 数据: 存在 (${planSize} 字符)`);
      } else {
        noPlanDataCount++;
        console.log(`   📋 plan 数据: 不存在`);
      }

      // 显示完整的 coursePlan 结构（前200字符）
      const coursePlanStr = JSON.stringify(coursePlan, null, 2);
      console.log(`   📦 coursePlan 结构预览:`);
      console.log(`      ${coursePlanStr.substring(0, 200)}${coursePlanStr.length > 200 ? '...' : ''}`);
    }

    // 输出统计信息
    console.log('\n' + '='.repeat(80));
    console.log('📊 统计信息:');
    console.log('='.repeat(80));
    console.log(`   有 planUrl: ${hasPlanUrlCount}`);
    console.log(`   无 planUrl: ${noPlanUrlCount}`);
    console.log(`   有 plan 数据: ${hasPlanDataCount}`);
    console.log(`   无 plan 数据: ${noPlanDataCount}`);
    console.log(`   总计: ${allCourses.length}`);
    console.log('='.repeat(80));

    // 显示一些示例数据
    if (hasPlanUrlCount > 0) {
      console.log('\n✅ 找到有 planUrl 的课程示例:');
      const courseWithUrl = allCourses.find(c => (c.coursePlan as any)?.planUrl);
      if (courseWithUrl) {
        const coursePlan = courseWithUrl.coursePlan as any;
        console.log(`   课程 ID: ${courseWithUrl.id}`);
        console.log(`   planUrl: ${coursePlan.planUrl}`);
        console.log(`   完整 coursePlan JSON:`);
        console.log(JSON.stringify(coursePlan, null, 2));
      }
    }

    console.log('\n💡 提示：');
    console.log('   在 Supabase 中查看时，请：');
    console.log('   1. 打开 user_courses 表');
    console.log('   2. 找到 course_plan 列（JSONB 类型）');
    console.log('   3. 点击展开 JSON 对象');
    console.log('   4. 查找 "planUrl" 属性');

    process.exit(0);
  } catch (error) {
    console.error('❌ 验证过程出错:', error);
    process.exit(1);
  }
}

main();

