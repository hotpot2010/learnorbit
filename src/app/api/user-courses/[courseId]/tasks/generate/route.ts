import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

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

    // 通过 Backend API 批量生成课程的所有任务
    const result = await backendAPI.tasks.generateTasks(courseId, userId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error generating course tasks:', error);
    return NextResponse.json(
      { error: 'Failed to generate course tasks' },
      { status: 500 }
    );
  }
}
