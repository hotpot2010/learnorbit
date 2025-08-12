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
    const requestData = await request.json();
    
    // 检查数据格式：新格式包含 plan 和 tasks，旧格式直接是 coursePlan
    const coursePlan = requestData.plan || requestData;
    const taskData = requestData.tasks || {};
    const notesData = requestData.notes || [];
    const marksData = requestData.marks || [];
    
    console.log('📥 接收到课程数据:', {
      hasPlan: !!coursePlan,
      hasTaskData: !!requestData.tasks,
      taskCount: Object.keys(taskData).length,
      hasNotes: Array.isArray(notesData),
      notesCount: Array.isArray(notesData) ? notesData.length : 0,
      hasMarks: Array.isArray(marksData),
      marksCount: Array.isArray(marksData) ? marksData.length : 0
    });

    // 保存课程信息到数据库
    const db = await getDb();
    const [newCourse] = await db
      .insert(userCourses)
      .values({
        userId: userId,
        coursePlan: {
          plan: coursePlan.plan || coursePlan,
          tasks: taskData, // 存储生成的任务数据
          notes: notesData, // 存储便签
          marks: marksData, // 存储彩笔标记
        },
        currentStep: 0,
        status: 'in-progress',
      })
      .returning();

    console.log('✅ 课程保存成功:', { courseId: newCourse.id });

    return NextResponse.json({ 
      course: newCourse,
      message: 'Course uploaded successfully'
    }, { status: 201 });
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
