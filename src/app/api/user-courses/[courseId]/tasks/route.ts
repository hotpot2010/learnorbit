import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

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

    // 通过 Backend API 获取课程任务
    const result = await backendAPI.tasks.getCourseTasks(courseId, userId);

    return NextResponse.json(result, { status: 200 });
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

    // 通过 Backend API 保存任务
    await backendAPI.tasks.saveTask(courseId, userId, stepNumber, taskContent);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error saving course task:', error);
    return NextResponse.json(
      { error: 'Failed to save course task' },
      { status: 500 }
    );
  }
}
