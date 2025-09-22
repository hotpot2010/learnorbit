#!/usr/bin/env tsx
/**
 * 课程URL转换脚本
 * 功能：将带用户ID的课程URL转换为简洁的创作者URL
 *
 * 使用方法：
 * 1. 预览模式（不实际修改数据）：pnpm tsx scripts/convert-course-urls.ts --preview
 * 2. 执行转换：pnpm tsx scripts/convert-course-urls.ts --execute
 * 3. 转换并删除原记录：pnpm tsx scripts/convert-course-urls.ts --execute --delete-original
 */

// 加载环境变量
import { config } from 'dotenv';
config();

import { getDb } from '../src/db';
import { userCourses, creatorCourses, user } from '../src/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { isCreatorEmail, generateCourseSlug } from '../src/lib/creator-utils';

interface CourseToConvert {
  id: string;
  userId: string;
  coursePlan: any;
  userName: string;
  userEmail: string;
  isCreator: boolean;
  originalSlug: string;
  newSlug: string;
  title: string;
}

// 从课程数据中提取标题
function extractCourseTitle(coursePlan: any): string {
  if (!coursePlan) return 'Untitled Course';

  const rawPlan = coursePlan.plan;

  // 新格式：rawPlan 是包含 title、description、plan 的对象
  if (rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan) && rawPlan.title) {
    return rawPlan.title;
  }

  // 旧格式：rawPlan 直接是步骤数组
  if (Array.isArray(rawPlan) && rawPlan.length > 0 && rawPlan[0]?.title) {
    return rawPlan[0].title;
  }

  return 'Untitled Course';
}

// 清理标题生成slug
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格、连字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim();
}

// 获取所有需要转换的课程
async function getCoursesToConvert(): Promise<CourseToConvert[]> {
  console.log('🔍 查找需要转换的公开课程...');

  const db = await getDb();

  // 查找所有公开的课程
  const courses = await db
    .select({
      courseId: userCourses.id,
      userId: userCourses.userId,
      coursePlan: userCourses.coursePlan,
      userName: user.name,
      userEmail: user.email,
      isCreator: user.isCreator,
    })
    .from(userCourses)
    .innerJoin(user, eq(userCourses.userId, user.id))
    .where(isNotNull(userCourses.coursePlan));

  const coursesToConvert: CourseToConvert[] = [];

  for (const course of courses) {
    // 检查课程是否公开
    const isPublic = course.coursePlan?.isPublic === true;
    if (!isPublic) continue;

    // 检查是否为创作者账号
    const isCreatorAccount = course.isCreator || isCreatorEmail(course.userEmail || '');

    const title = extractCourseTitle(course.coursePlan);
    const originalSlug = generateCourseSlug(title, course.userId, false); // 带用户ID的slug
    const newSlug = generateCourseSlug(title, course.userId, true); // 简洁slug

    // 检查是否已经存在创作者课程记录
    const existingCreatorCourse = await db
      .select()
      .from(creatorCourses)
      .where(eq(creatorCourses.courseId, course.courseId))
      .limit(1);

    if (existingCreatorCourse.length > 0) {
      console.log(`⏭️  课程 "${title}" 已有创作者URL，跳过`);
      continue;
    }

    coursesToConvert.push({
      id: course.courseId,
      userId: course.userId,
      coursePlan: course.coursePlan,
      userName: course.userName,
      userEmail: course.userEmail || '',
      isCreator: isCreatorAccount,
      originalSlug,
      newSlug,
      title,
    });
  }

  return coursesToConvert;
}

// 预览转换结果
async function previewConversion() {
  console.log('📋 预览模式 - 不会修改任何数据\n');

  const coursesToConvert = await getCoursesToConvert();

  if (coursesToConvert.length === 0) {
    console.log('✅ 没有找到需要转换的课程');
    return;
  }

  console.log(`📊 找到 ${coursesToConvert.length} 个可转换的课程：\n`);

  coursesToConvert.forEach((course, index) => {
    console.log(`${index + 1}. ${course.title}`);
    console.log(`   创作者: ${course.userName} (${course.userEmail})`);
    console.log(`   原URL: /study/${course.originalSlug}`);
    console.log(`   新URL: /study/${course.newSlug}`);
    console.log(`   创作者账号: ${course.isCreator ? '是' : '否'}`);
    console.log('');
  });

  console.log('💡 使用 --execute 参数执行实际转换');
}

// 执行转换
async function executeConversion(deleteOriginal = false) {
  console.log('🚀 执行转换模式\n');

  const coursesToConvert = await getCoursesToConvert();

  if (coursesToConvert.length === 0) {
    console.log('✅ 没有找到需要转换的课程');
    return;
  }

  const db = await getDb();
  let successCount = 0;
  let errorCount = 0;

  console.log(`🔄 开始转换 ${coursesToConvert.length} 个课程...\n`);

  for (const course of coursesToConvert) {
    try {
      console.log(`📝 处理: ${course.title}`);

      // 检查新slug是否已被占用
      const existingSlug = await db
        .select()
        .from(creatorCourses)
        .where(eq(creatorCourses.slug, course.newSlug))
        .limit(1);

      if (existingSlug.length > 0) {
        console.log(`   ❌ slug "${course.newSlug}" 已被占用，跳过`);
        errorCount++;
        continue;
      }

      // 创建创作者课程记录
      const newCreatorCourse = await db
        .insert(creatorCourses)
        .values({
          slug: course.newSlug,
          courseId: course.id,
          creatorId: course.userId,
          title: course.title,
          description: course.coursePlan?.plan?.description || '',
          isActive: true,
        })
        .returning();

      console.log(`   ✅ 创建简洁URL: /study/${course.newSlug}`);

      // 如果指定删除原记录，则删除用户课程记录
      if (deleteOriginal) {
        await db
          .delete(userCourses)
          .where(eq(userCourses.id, course.id));

        console.log(`   🗑️  删除原记录: ${course.id}`);
      }

      successCount++;

    } catch (error) {
      console.error(`   ❌ 转换失败: ${error}`);
      errorCount++;
    }

    console.log('');
  }

  console.log('📊 转换完成:');
  console.log(`   ✅ 成功: ${successCount} 个`);
  console.log(`   ❌ 失败: ${errorCount} 个`);

  if (deleteOriginal) {
    console.log(`   🗑️  已删除 ${successCount} 个原记录`);
  } else {
    console.log('   💡 原记录保留，如需删除请使用 --delete-original 参数');
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const isPreview = args.includes('--preview');
  const isExecute = args.includes('--execute');
  const deleteOriginal = args.includes('--delete-original');

  console.log('🎯 课程URL转换脚本');
  console.log('='.repeat(50));

  if (isPreview) {
    await previewConversion();
  } else if (isExecute) {
    if (deleteOriginal) {
      console.log('⚠️  警告：将删除原始课程记录！');
      console.log('⚠️  请确保您已经备份了数据库！');
      console.log('');
    }
    await executeConversion(deleteOriginal);
  } else {
    console.log('📖 使用说明：');
    console.log('');
    console.log('1. 预览模式（查看将要转换的课程）：');
    console.log('   pnpm tsx scripts/convert-course-urls.ts --preview');
    console.log('');
    console.log('2. 执行转换（保留原记录）：');
    console.log('   pnpm tsx scripts/convert-course-urls.ts --execute');
    console.log('');
    console.log('3. 执行转换并删除原记录：');
    console.log('   pnpm tsx scripts/convert-course-urls.ts --execute --delete-original');
    console.log('');
    console.log('⚠️  建议先使用 --preview 查看转换计划');
  }
}

// 运行脚本
main().catch(console.error);
