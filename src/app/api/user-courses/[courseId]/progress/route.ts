import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { auth } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

    // 更新课程进度
    const db = await getDb();
    const [updatedCourse] = await db
      .update(userCourses)
      .set({
        currentStep: currentStep,
        status: status,
        updatedAt: new Date(),
      })
      .where(and(eq(userCourses.id, courseId), eq(userCourses.userId, userId)))
      .returning();

    if (!updatedCourse) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

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

    // 获取课程信息
    const db = await getDb();
    const [course] = await db
      .select()
      .from(userCourses)
      .where(and(eq(userCourses.id, courseId), eq(userCourses.userId, userId)));

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ course }, { status: 200 });
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}
