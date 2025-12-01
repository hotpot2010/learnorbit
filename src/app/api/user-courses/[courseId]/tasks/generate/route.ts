import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { auth } from '@/lib/auth';
import type { TaskGenerateRequest } from '@/types/learning-plan';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const EXTERNAL_API_URL =
  process.env.NEXT_PUBLIC_EXTERNAL_API_URL || 'http://172.30.106.167:5000';

// 批量生成课程的所有任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const resolvedParams = await params;
    const courseId = resolvedParams.courseId;

    // 获取课程
    const db = await getDb();
    const [course] = await db
      .select()
      .from(userCourses)
      .where(and(eq(userCourses.id, courseId), eq(userCourses.userId, userId)))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.tasksGenerated) {
      return NextResponse.json(
        {
          message: 'Tasks already generated',
          tasksGenerated: true,
        },
        { status: 200 }
      );
    }

    const coursePlan = course.coursePlan;
    if (!coursePlan?.plan) {
      return NextResponse.json(
        { error: 'Invalid course plan' },
        { status: 400 }
      );
    }

    // 获取步骤数组
    const steps = Array.isArray(coursePlan.plan) 
      ? coursePlan.plan 
      : coursePlan.plan.plan || [];

    console.log(
      `🚀 开始为课程 ${courseId} 生成所有任务，共 ${steps.length} 个步骤`
    );

    const results = [];

    // 并行生成所有任务
    const taskPromises = steps.map(async (step: any) => {
      try {
        console.log(`📤 生成步骤 ${step.step} 的任务: ${step.title}`);

        const requestData: TaskGenerateRequest = {
          step: step.step,
          title: step.title,
          description: step.description,
          animation_type: '无',
          status: step.status,
          type: step.type,
          difficulty: step.difficulty,
          videos: step.videos || [],
        };

        // 调用外部API生成任务
        const response = await fetch(`${EXTERNAL_API_URL}/api/task/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.task) {
            // 任务数据会在最后统一保存到 coursePlan.tasks
            console.log(`✅ 步骤 ${step.step} 任务生成成功`);
            return { step: step.step, success: true, task: result.task };
          }
        }

        console.log(`❌ 步骤 ${step.step} 任务生成失败`);
        return { step: step.step, success: false, error: 'Generation failed' };
      } catch (error) {
        console.error(`❌ 步骤 ${step.step} 任务生成出错:`, error);
        return {
          step: step.step,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // 等待所有任务完成
    const taskResults = await Promise.all(taskPromises);
    const successCount = taskResults.filter((r) => r.success).length;

    console.log(`📊 任务生成完成: ${successCount}/${taskResults.length} 成功`);

    // 如果大部分任务成功生成，保存到 coursePlan.tasks 并标记为已生成
    if (successCount >= taskResults.length * 0.7) {
      // 构建任务数据对象
      const tasks: Record<number, any> = {};
      taskResults.forEach((result) => {
        if (result.success && result.task) {
          tasks[result.step] = result.task;
        }
      });

      // 更新课程，保存任务数据到 coursePlan.tasks
      const updatedCoursePlan = {
        ...coursePlan,
        tasks: {
          ...(coursePlan?.tasks || {}),
          ...tasks,
        },
      };

      await db
        .update(userCourses)
        .set({
          coursePlan: updatedCoursePlan,
          tasksGenerated: true,
        })
        .where(eq(userCourses.id, courseId));
    }

    return NextResponse.json(
      {
        success: true,
        results: taskResults,
        successCount,
        totalCount: taskResults.length,
        tasksGenerated: successCount >= taskResults.length * 0.7,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating course tasks:', error);
    return NextResponse.json(
      { error: 'Failed to generate course tasks' },
      { status: 500 }
    );
  }
}
