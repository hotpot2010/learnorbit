import { getDb } from '@/db';
import { userCourses, creatorCourses, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { isCreatorEmail, generateCourseSlug } from '@/lib/creator-utils';

// 自动为创作者的公开课程创建简洁URL映射
async function createCreatorUrlIfNeeded(db: any, courseId: string, userId: string, coursePlan: any) {
  try {
    // 检查课程是否公开
    const isPublic = coursePlan?.isPublic === true;
    if (!isPublic) {
      console.log('📝 课程未公开，跳过创作者URL创建');
      return;
    }

    // 获取用户信息
    const userData = await db
      .select({
        email: user.email,
        isCreator: user.isCreator,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userData.length) {
      console.log('❌ 用户信息未找到');
      return;
    }

    const userInfo = userData[0];
    const isCreatorAccount = userInfo.isCreator || isCreatorEmail(userInfo.email || '');

    if (!isCreatorAccount) {
      console.log('📝 非创作者账号，跳过创作者URL创建');
      return;
    }

    // 提取课程标题
    let title = 'Untitled Course';
    if (coursePlan?.title) {
      title = coursePlan.title;
    } else if (coursePlan?.plan?.title) {
      title = coursePlan.plan.title;
    } else if (Array.isArray(coursePlan?.plan) && coursePlan.plan[0]?.title) {
      title = coursePlan.plan[0].title;
    }

    // 生成简洁slug
    const slug = generateCourseSlug(title, userId, true);

    // 检查slug是否已存在
    const existingSlug = await db
      .select()
      .from(creatorCourses)
      .where(eq(creatorCourses.slug, slug))
      .limit(1);

    if (existingSlug.length > 0) {
      console.log(`⚠️ 创作者URL slug "${slug}" 已存在，跳过创建`);
      return;
    }

    // 创建创作者课程映射
    await db
      .insert(creatorCourses)
      .values({
        slug,
        courseId,
        creatorId: userId,
        title,
        description: coursePlan?.description || coursePlan?.plan?.description || '',
        isActive: true,
      });

    console.log(`🎉 自动创建创作者简洁URL: /study/${slug}`);

  } catch (error) {
    console.error('❌ 自动创建创作者URL失败:', error);
    // 不抛出错误，避免影响课程保存
  }
}

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
          plan: coursePlan, // 直接使用完整的coursePlan，包含title、description、introduction
          tasks: taskData, // 存储生成的任务数据
          notes: notesData, // 存储便签
          marks: marksData, // 存储彩笔标记
        },
        currentStep: 0,
        status: 'in-progress',
      })
      .returning();

    console.log('✅ 课程保存成功:', { courseId: newCourse.id });

    // 检查是否为创作者的公开课程，如果是则自动创建简洁URL映射
    await createCreatorUrlIfNeeded(db, newCourse.id, userId, coursePlan);

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
