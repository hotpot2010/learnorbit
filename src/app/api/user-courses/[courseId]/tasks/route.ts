import { getDb } from '@/db';
import { courseTasks, userCourses } from '@/db/schema';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// 获取课程的所有任务
export async function GET(
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

    // 验证课程归属
    const db = await getDb();
    const [course] = await db
      .select()
      .from(userCourses)
      .where(and(eq(userCourses.id, courseId), eq(userCourses.userId, userId)))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // 获取所有任务
    const tasks = await db
      .select()
      .from(courseTasks)
      .where(eq(courseTasks.courseId, courseId))
      .orderBy(courseTasks.stepNumber);

    // 转换为任务缓存格式
    const taskCache: Record<number, any> = {};
    tasks.forEach((task) => {
      taskCache[task.stepNumber] = task.taskContent;
    });

    return NextResponse.json(
      {
        taskCache,
        tasksGenerated: course.tasksGenerated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching course tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course tasks' },
      { status: 500 }
    );
  }
}

// 保存课程任务
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
    const { stepNumber, taskContent } = await request.json();

    // 验证课程归属
    const db = await getDb();
    const [course] = await db
      .select()
      .from(userCourses)
      .where(and(eq(userCourses.id, courseId), eq(userCourses.userId, userId)))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // 保存任务 - 使用upsert逻辑
    try {
      await db.insert(courseTasks).values({
        courseId,
        stepNumber,
        taskContent,
      });
    } catch (error) {
      // 如果存在冲突，更新现有记录
      await db
        .update(courseTasks)
        .set({
          taskContent,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(courseTasks.courseId, courseId),
            eq(courseTasks.stepNumber, stepNumber)
          )
        );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error saving course task:', error);
    return NextResponse.json(
      { error: 'Failed to save course task' },
      { status: 500 }
    );
  }
}
