import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

// 更新课程进度
export async function PUT(
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
    const { currentStep, status } = await request.json();

    // 通过 Backend API 更新课程进度
    const updatedCourse = await backendAPI.courses.updateProgress(courseId, userId, currentStep, status);

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch (error) {
    console.error('Error updating course progress:', error);
    return NextResponse.json(
      { error: 'Failed to update course progress' },
      { status: 500 }
    );
  }
}

// 获取特定课程信息
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

    // 通过 Backend API 获取课程信息
    const course = await backendAPI.courses.get(courseId, userId);

    return NextResponse.json({ course }, { status: 200 });
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}
