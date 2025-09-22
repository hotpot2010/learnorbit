#!/usr/bin/env tsx
/**
 * 特定课程URL转换脚本
 * 功能：将指定的带用户ID的课程URL转换为简洁的创作者URL
 *
 * 使用方法：
 * 1. 转换单个URL：pnpm tsx scripts/convert-specific-course-url.ts "study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0"
 * 2. 转换多个URL：pnpm tsx scripts/convert-specific-course-url.ts "url1" "url2" "url3"
 * 3. 转换并删除原记录：pnpm tsx scripts/convert-specific-course-url.ts "url" --delete-original
 */

// 加载环境变量
import { config } from 'dotenv';
config();

import { getDb } from '../src/db';
import { userCourses, creatorCourses, user } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { isCreatorEmail, generateCourseSlug } from '../src/lib/creator-utils';

interface CourseInfo {
  id: string;
  userId: string;
  coursePlan: any;
  userName: string;
  userEmail: string;
  isCreator: boolean;
  title: string;
  originalSlug: string;
  newSlug: string;
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

// 解析URL获取课程信息
async function parseCourseUrl(url: string): Promise<CourseInfo | null> {
  // 移除可能的前缀和后缀
  const cleanUrl = url.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\//, '').replace(/\/$/, '');

  // 确保是study路径
  if (!cleanUrl.startsWith('study/')) {
    console.log(`❌ 无效的URL格式: ${url} (必须以 study/ 开头)`);
    return null;
  }

  // 提取slug部分
  const slug = cleanUrl.replace('study/', '');

  // 解析slug: [title]-[userId]
  const lastDash = slug.lastIndexOf('-');
  if (lastDash <= 0) {
    console.log(`❌ 无效的slug格式: ${slug} (未找到用户ID)`);
    return null;
  }

  const titlePart = slug.slice(0, lastDash);
  const userId = slug.slice(lastDash + 1);

  console.log(`🔍 解析URL: ${url}`);
  console.log(`   标题部分: ${titlePart}`);
  console.log(`   用户ID: ${userId}`);

  const db = await getDb();

  // 查找匹配的课程
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
    .where(eq(userCourses.userId, userId));

  // 在匹配的课程中找到标题匹配的
  for (const course of courses) {
    const title = extractCourseTitle(course.coursePlan);
    const slugifiedTitle = slugifyTitle(title);

    if (slugifiedTitle === titlePart) {
      const isCreatorAccount = course.isCreator || isCreatorEmail(course.userEmail || '');
      const originalSlug = generateCourseSlug(title, course.userId, false);
      const newSlug = generateCourseSlug(title, course.userId, true);

      return {
        id: course.courseId,
        userId: course.userId,
        coursePlan: course.coursePlan,
        userName: course.userName,
        userEmail: course.userEmail || '',
        isCreator: isCreatorAccount,
        title,
        originalSlug,
        newSlug,
      };
    }
  }

  console.log(`❌ 未找到匹配的课程: ${url}`);
  return null;
}

// 转换单个课程URL
async function convertCourseUrl(courseInfo: CourseInfo, deleteOriginal: boolean): Promise<boolean> {
  const db = await getDb();

  try {
    console.log(`📝 处理课程: ${courseInfo.title}`);
    console.log(`   创作者: ${courseInfo.userName} (${courseInfo.userEmail})`);
    console.log(`   原URL: /study/${courseInfo.originalSlug}`);
    console.log(`   新URL: /study/${courseInfo.newSlug}`);

    // 检查课程是否公开
    const isPublic = courseInfo.coursePlan?.isPublic === true;
    if (!isPublic) {
      console.log('   ❌ 课程未公开，跳过转换');
      return false;
    }

    // 检查是否已经存在创作者课程记录
    const existingCreatorCourse = await db
      .select()
      .from(creatorCourses)
      .where(eq(creatorCourses.courseId, courseInfo.id))
      .limit(1);

    if (existingCreatorCourse.length > 0) {
      console.log('   ⏭️  已存在创作者URL记录，跳过');
      return false;
    }

    // 检查新slug是否已被占用
    const existingSlug = await db
      .select()
      .from(creatorCourses)
      .where(eq(creatorCourses.slug, courseInfo.newSlug))
      .limit(1);

    if (existingSlug.length > 0) {
      console.log(`   ❌ slug "${courseInfo.newSlug}" 已被占用，跳过`);
      return false;
    }

    // 创建创作者课程记录
    await db
      .insert(creatorCourses)
      .values({
        slug: courseInfo.newSlug,
        courseId: courseInfo.id,
        creatorId: courseInfo.userId,
        title: courseInfo.title,
        description: courseInfo.coursePlan?.plan?.description || '',
        isActive: true,
      });

    console.log(`   ✅ 创建简洁URL成功: /study/${courseInfo.newSlug}`);

    // 如果指定删除原记录，则删除用户课程记录
    if (deleteOriginal) {
      await db
        .delete(userCourses)
        .where(eq(userCourses.id, courseInfo.id));

      console.log(`   🗑️  删除原记录: ${courseInfo.id}`);
    }

    return true;

  } catch (error) {
    console.error(`   ❌ 转换失败: ${error}`);
    return false;
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('🎯 特定课程URL转换脚本');
    console.log('='.repeat(50));
    console.log('');
    console.log('📖 使用说明：');
    console.log('');
    console.log('1. 转换单个URL：');
    console.log('   pnpm tsx scripts/convert-specific-course-url.ts "study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0"');
    console.log('');
    console.log('2. 转换多个URL：');
    console.log('   pnpm tsx scripts/convert-specific-course-url.ts "url1" "url2" "url3"');
    console.log('');
    console.log('3. 转换并删除原记录：');
    console.log('   pnpm tsx scripts/convert-specific-course-url.ts "url" --delete-original');
    console.log('');
    console.log('⚠️  支持的URL格式：');
    console.log('   - study/course-name-userId');
    console.log('   - /study/course-name-userId');
    console.log('   - https://domain.com/study/course-name-userId');
    return;
  }

  const deleteOriginal = args.includes('--delete-original');
  const urls = args.filter(arg => !arg.startsWith('--'));

  if (urls.length === 0) {
    console.log('❌ 请提供至少一个URL');
    return;
  }

  console.log('🎯 特定课程URL转换脚本');
  console.log('='.repeat(50));
  console.log('');

  if (deleteOriginal) {
    console.log('⚠️  警告：将删除原始课程记录！');
    console.log('⚠️  请确保您已经备份了数据库！');
    console.log('');
  }

  let successCount = 0;
  let errorCount = 0;

  console.log(`🔄 开始处理 ${urls.length} 个URL...\n`);

  for (const url of urls) {
    console.log(`🔍 处理URL: ${url}`);

    try {
      const courseInfo = await parseCourseUrl(url);

      if (!courseInfo) {
        errorCount++;
        console.log('');
        continue;
      }

      const success = await convertCourseUrl(courseInfo, deleteOriginal);

      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

    } catch (error) {
      console.error(`❌ 处理URL失败: ${error}`);
      errorCount++;
    }

    console.log('');
  }

  console.log('📊 处理完成:');
  console.log(`   ✅ 成功: ${successCount} 个`);
  console.log(`   ❌ 失败/跳过: ${errorCount} 个`);

  if (deleteOriginal && successCount > 0) {
    console.log(`   🗑️  已删除 ${successCount} 个原记录`);
  } else if (successCount > 0) {
    console.log('   💡 原记录保留，如需删除请使用 --delete-original 参数');
  }
}

// 运行脚本
main().catch(console.error);
