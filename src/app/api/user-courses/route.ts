import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { auth } from '@/lib/auth';
import { desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

// 创建新课程
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const coursePlan = await request.json();

    // 保存课程信息到数据库
    const db = await getDb();
    const [newCourse] = await db
      .insert(userCourses)
      .values({
        userId: userId,
        coursePlan: coursePlan,
        currentStep: 0,
        status: 'in-progress',
      })
      .returning();

    return NextResponse.json({ course: newCourse }, { status: 201 });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}

// 获取用户的所有课程
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 从数据库获取用户课程
    const db = await getDb();
    const courses = await db
      .select()
      .from(userCourses)
      .where(eq(userCourses.userId, userId))
      .orderBy(desc(userCourses.createdAt));

    return NextResponse.json({ courses }, { status: 200 });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
