#!/usr/bin/env tsx

/**
 * 迁移脚本：将 coursePlan.plan 的 JSON 数据上传到 CDN
 * 
 * 功能：
 * 1. 扫描所有 user_courses 记录
 * 2. 检查 coursePlan.plan 是否存在且不为空
 * 3. 将 plan 数据序列化为 JSON 文件
 * 4. 上传到 CDN（使用 /open-api/upload 接口）
 * 5. 更新数据库中的 coursePlan.planUrl 字段
 * 
 * 使用方法：
 *   pnpm tsx scripts/migrate-course-plan-to-cdn.ts
 */

import 'dotenv/config';
import { getDb } from '../src/db/index';
import { userCourses } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';

// 配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const UPLOAD_ENDPOINT = `${API_BASE_URL}/open-api/upload`;
const CDN_BASE_URL = 'http://file.gsxservice.com';

interface UploadResponse {
  total?: number;
  ok?: number;
  fail?: number;
  files?: Array<{
    key: string;
    url: string;
    [key: string]: any;
  }>;
  code?: number;
  data?: {
    url?: string;
    path?: string;
  };
  url?: string;
}

/**
 * 上传 JSON 文件到 CDN
 */
async function uploadJsonToCDN(jsonContent: string, filename: string): Promise<string> {
  try {
    // 创建 FormData（Node.js 环境）
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // 创建 Buffer 对象
    const buffer = Buffer.from(jsonContent, 'utf-8');
    formData.append('file0', buffer, {
      filename: filename,
      contentType: 'application/json',
    });

    console.log(`📤 上传文件: ${filename} (${buffer.length} bytes)`);

    // 获取 headers（包含 boundary）
    const headers = formData.getHeaders();
    
    // 使用 Node.js 的 http/https 模块发送请求（更好的 form-data 支持）
    const url = new URL(UPLOAD_ENDPOINT);
    const httpModule = url.protocol === 'https:' ? await import('https') : await import('http');
    
    return new Promise<string>((resolve, reject) => {
      const request = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: headers,
        },
        (response) => {
          let responseData = '';
          
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              try {
                const result: UploadResponse = JSON.parse(responseData);
                console.log(`✅ 上传响应:`, JSON.stringify(result, null, 2));
                
                // 解析响应获取 URL
                let fileUrl: string | null = null;

                // 格式1: files 数组格式
                if (result.files && Array.isArray(result.files) && result.files.length > 0) {
                  const fileInfo = result.files[0];
                  fileUrl = fileInfo.url || fileInfo.path || null;
                }
                // 格式2: data 对象格式
                else if (result.code === 0 && result.data) {
                  fileUrl = result.data.url || result.data.path || null;
                }
                // 格式3: 直接返回 URL
                else if (result.url) {
                  fileUrl = result.url;
                }

                if (!fileUrl) {
                  reject(new Error(`无法从响应中提取URL: ${JSON.stringify(result)}`));
                  return;
                }

                // 处理相对路径
                if (!fileUrl.startsWith('http')) {
                  const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
                  fileUrl = `${CDN_BASE_URL}${normalizedPath}`;
                }

                console.log(`📎 文件URL: ${fileUrl}`);
                resolve(fileUrl);
              } catch (parseError) {
                reject(new Error(`解析响应失败: ${parseError}\n响应内容: ${responseData}`));
              }
            } else {
              reject(new Error(`上传失败 (${response.statusCode}): ${responseData}`));
            }
          });
        }
      );
      
      request.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });
      
      // 将 form-data stream 连接到 request
      formData.pipe(request);
    });

  } catch (error) {
    console.error(`❌ 上传失败:`, error);
    throw error;
  }
}

/**
 * 迁移单个课程的 plan 数据到 CDN
 */
async function migrateCoursePlan(course: any): Promise<boolean> {
  try {
    const courseId = course.id;
    const coursePlan = course.coursePlan as any;

    // 检查是否已经有 planUrl（现在检查独立列）
    if (course.planUrl) {
      console.log(`⏭️  课程 ${courseId} 已有 planUrl，跳过`);
      return false;
    }

    // 检查 plan 是否存在
    const planData = coursePlan?.plan;
    if (!planData) {
      console.log(`⏭️  课程 ${courseId} 没有 plan 数据，跳过`);
      return false;
    }

    // 序列化为 JSON
    const jsonContent = JSON.stringify(planData, null, 2);
    const jsonSize = Buffer.byteLength(jsonContent, 'utf-8');
    
    console.log(`\n📋 处理课程: ${courseId}`);
    console.log(`   数据大小: ${jsonSize} bytes (${(jsonSize / 1024).toFixed(2)} KB)`);

    // 生成文件名
    const filename = `course_plan_${courseId}_${Date.now()}.json`;

    // 上传到 CDN
    const planUrl = await uploadJsonToCDN(jsonContent, filename);

    // 更新数据库（planUrl 现在是独立列）
    const db = await getDb();

    console.log(`💾 更新数据库: courseId=${courseId}, planUrl=${planUrl}`);

    const [updatedCourse] = await db
      .update(userCourses)
      .set({
        planUrl: planUrl, // 更新独立列
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

    console.log(`✅ 课程 ${courseId} 迁移成功，planUrl: ${updatedCourse.planUrl}`);
    return true;
  } catch (error) {
    console.error(`❌ 课程 ${course.id} 迁移失败:`, error);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始迁移 coursePlan.plan 到 CDN...');
    console.log(`📍 API URL: ${UPLOAD_ENDPOINT}`);
    console.log(`📍 CDN Base URL: ${CDN_BASE_URL}\n`);

    const db = await getDb();

    // 确保 plan_url 列存在
    try {
      console.log('🔧 检查 plan_url 列是否存在...');
      await db.execute(sql`ALTER TABLE "user_courses" ADD COLUMN IF NOT EXISTS "plan_url" TEXT`);
      console.log('✅ plan_url 列已就绪\n');
    } catch (error: any) {
      // 如果列已存在，忽略错误
      if (error?.code !== '42703') { // 42703 = undefined_column (列已存在时不会报这个错)
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
        const migrated = await migrateCoursePlan(course);
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

