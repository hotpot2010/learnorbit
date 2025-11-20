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
    const learningPlanData = requestData.plan || requestData;
    const taskData = requestData.tasks || {};
    const notesData = requestData.notes || [];
    const marksData = requestData.marks || [];
    
    console.log('📥 接收到课程数据:', {
      hasPlan: !!learningPlanData,
      planType: Array.isArray(learningPlanData) ? 'array' : typeof learningPlanData,
      hasPlanField: !!(learningPlanData && typeof learningPlanData === 'object' && 'plan' in learningPlanData),
      planFieldType: (learningPlanData && typeof learningPlanData === 'object' && 'plan' in learningPlanData) 
        ? (Array.isArray(learningPlanData.plan) ? 'array' : typeof learningPlanData.plan) 
        : 'N/A',
      hasNestedPlan: !!(learningPlanData && typeof learningPlanData === 'object' && learningPlanData.plan && typeof learningPlanData.plan === 'object' && 'plan' in learningPlanData.plan),
      hasTitle: !!(learningPlanData && typeof learningPlanData === 'object' && 'title' in learningPlanData),
      hasDescription: !!(learningPlanData && typeof learningPlanData === 'object' && 'description' in learningPlanData),
      hasTaskData: !!requestData.tasks,
      taskCount: Object.keys(taskData).length,
      hasNotes: Array.isArray(notesData),
      notesCount: Array.isArray(notesData) ? notesData.length : 0,
      hasMarks: Array.isArray(marksData),
      marksCount: Array.isArray(marksData) ? marksData.length : 0
    });
    
    // 打印 learningPlanData 的结构（仅前1000字符）
    if (learningPlanData) {
      const planStr = JSON.stringify(learningPlanData).substring(0, 1000);
      console.log('📋 learningPlanData 结构预览:', planStr);
    }

    // 处理 learningPlan 数据格式
    // 数据库期望格式：coursePlan.plan 应该是 LearningPlan 格式 { plan: [...], title, description }
    // 或者旧格式：{ plan: [...] }
    // 
    // 注意：如果 learningPlanData 已经是 LearningPlan 格式，直接使用，不要多包一层
    // 如果 learningPlanData 是数组，包装为 { plan: [...] }
    // 如果 learningPlanData 是 { plan: { plan: [...] } }（3层），解包一层
    let planDataForDb: any;
    
    if (Array.isArray(learningPlanData)) {
      // 情况1：直接是步骤数组（旧格式），包装为 { plan: [...] }
      planDataForDb = {
        plan: learningPlanData
      };
      console.log('📦 情况1：步骤数组，包装为 { plan: [...] }');
    } else if (learningPlanData && typeof learningPlanData === 'object') {
      // 检查 plan 字段的类型
      if ('plan' in learningPlanData) {
        if (Array.isArray(learningPlanData.plan)) {
          // 情况2：已经是 LearningPlan 格式 { plan: [...], title, description }
          // 直接使用，不要多包一层
          planDataForDb = learningPlanData;
          console.log('📦 情况2：LearningPlan 格式 { plan: [...], title, description }，直接使用');
        } else if (learningPlanData.plan && typeof learningPlanData.plan === 'object' && 'plan' in learningPlanData.plan) {
          // 情况3：检测到3层结构 { plan: { plan: [...] } }，解包一层
          // 保留外层的 title、description 等字段（如果有）
          planDataForDb = {
            ...learningPlanData.plan,
            // 如果外层有 title、description，优先使用外层的
            title: learningPlanData.title || learningPlanData.plan.title,
            description: learningPlanData.description || learningPlanData.plan.description,
          };
          console.log('📦 情况3：检测到3层结构，解包一层');
        } else {
          // plan 字段存在但不是数组也不是对象，直接使用
          planDataForDb = learningPlanData;
          console.log('⚠️ plan 字段存在但格式异常，直接使用');
        }
      } else {
        // 没有 plan 字段的对象，包装为 { plan: learningPlanData }
        planDataForDb = {
          plan: learningPlanData
        };
        console.log('⚠️ 没有 plan 字段的对象，包装为 { plan: ... }');
      }
    } else {
      // 其他类型（null、undefined、基本类型），包装为对象
      planDataForDb = {
        plan: learningPlanData || []
      };
      console.log('⚠️ 其他类型，包装为 { plan: ... }');
    }
    
    console.log('📊 最终 planDataForDb 结构:', {
      hasPlan: 'plan' in planDataForDb,
      planIsArray: Array.isArray(planDataForDb?.plan),
      hasTitle: !!planDataForDb?.title,
      hasDescription: !!planDataForDb?.description,
      planLength: Array.isArray(planDataForDb?.plan) ? planDataForDb.plan.length : 'N/A',
      structurePreview: JSON.stringify(planDataForDb).substring(0, 200)
    });

    // 保存课程信息到数据库
    const db = await getDb();
    const [newCourse] = await db
      .insert(userCourses)
      .values({
        userId: userId,
        coursePlan: {
          plan: planDataForDb, // LearningPlan 格式：{ plan: [...], title, description } 或旧格式：{ plan: [...] }
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
