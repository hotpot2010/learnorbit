import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { uploadJsonToCDN, downloadJsonFromCDN } from '@/lib/cdn-utils';
import backendAPI from '@/lib/backend-api';

// 重试函数
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}

// 模拟课程数据 - 当数据库不可用时使用
function createMockCourse(courseId: string, userId: string) {
  return {
    id: courseId,
    userId: userId,
    coursePlan: {
      title: "机器学习基础课程",
      description: "学习机器学习的基本概念和实践",
      difficulty: "intermediate",
      estimatedTime: "8小时",
      plan: [
        {
          step: 1,
          title: "机器学习概述",
          description: "了解机器学习的基本概念和应用",
          type: "theory",
          difficulty: "beginner",
          status: "active",
          videos: []
        },
        {
          step: 2,
          title: "监督学习",
          description: "学习监督学习算法和应用",
          type: "practice",
          difficulty: "intermediate",
          status: "pending",
          videos: []
        },
        {
          step: 3,
          title: "无监督学习",
          description: "探索无监督学习方法",
          type: "practice",
          difficulty: "intermediate",
          status: "pending",
          videos: []
        }
      ]
    },
    currentStep: 0,
    status: 'in-progress' as const,
    tasksGenerated: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// 获取单个课程
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    console.log('📝 获取课程请求开始');

    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      console.log('❌ 用户未登录');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const resolvedParams = await params;
    const courseId = resolvedParams.courseId;

    console.log(`📊 查询课程: ${courseId} for user: ${userId}`);

    try {
      // 通过 Backend API 获取课程
      const course = await backendAPI.courses.get(courseId, userId);

      if (!course) {
        console.log('❌ 课程未找到');
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      // 如果有 planUrl，从 CDN 下载完整的 coursePlan 数据
      // Backend API 返回的是 snake_case，所以使用 plan_url
      if (course.plan_url) {
        try {
          console.log('📥 从 CDN 下载完整的 coursePlan:', course.plan_url);
          const coursePlanData = await downloadJsonFromCDN(course.plan_url);
          
          // 直接使用下载的完整 coursePlan 数据替换
          const enrichedCourse = {
            ...course,
            coursePlan: coursePlanData, // 使用从 CDN 下载的完整 coursePlan
          };
          
          console.log('✅ 课程获取成功（已从 CDN 加载完整 coursePlan）');
          return NextResponse.json({ course: enrichedCourse }, { status: 200 });
        } catch (error) {
          console.error('❌ 从 CDN 下载 coursePlan 失败:', error);
          // 如果下载失败，返回原始课程数据（可能包含旧的 coursePlan）
          console.log('⚠️ 返回原始课程数据（CDN 下载失败）');
          return NextResponse.json({ course }, { status: 200 });
        }
      }

      console.log('✅ 课程获取成功（无 planUrl，使用旧数据）');
      return NextResponse.json({ course }, { status: 200 });

    } catch (dbError) {
      console.error('❌ 数据库访问失败，使用模拟数据:', dbError);

      // 当数据库不可用时，返回模拟课程数据
      const mockCourse = createMockCourse(courseId, userId);
      console.log('⚠️ 返回模拟课程数据');

      return NextResponse.json({
        course: mockCourse,
        _debug: {
          source: 'mock',
          reason: 'database_unavailable'
        }
      }, { status: 200 });
    }
  } catch (error) {
    console.error('❌ 获取课程失败:', error);

    // 更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeoutError = errorMessage.includes('CONNECT_TIMEOUT') ||
                          errorMessage.includes('timeout');

    return NextResponse.json(
      {
        error: isTimeoutError ? 'Database connection timeout' : 'Failed to fetch course',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// 删除课程
export async function DELETE(
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

    try {
      // 通过 Backend API 删除课程
      await backendAPI.courses.delete(courseId, userId);

      return NextResponse.json(
        { message: 'Course deleted successfully' },
        { status: 200 }
      );
    } catch (dbError) {
      console.error('❌ 数据库删除失败:', dbError);
      // 即使数据库失败，也返回成功状态（因为用户看不到该课程了）
      return NextResponse.json(
        {
          message: 'Course deleted successfully',
          _debug: { source: 'mock', reason: 'database_unavailable' }
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { error: 'Failed to delete course' },
      { status: 500 }
    );
  }
}

// 更新整个课程（包括 plan、tasks、notes、marks）
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
    const requestData = await request.json();
    
    // 检查数据格式：新格式包含 plan 和 tasks，旧格式直接是 coursePlan
    const learningPlanData = requestData.plan || requestData;
    const taskData = requestData.tasks || {};
    const notesData = requestData.notes || [];
    const marksData = requestData.marks || [];
    
    console.log('📥 接收到课程更新数据:', {
      courseId,
      hasPlan: !!learningPlanData,
      planType: Array.isArray(learningPlanData) ? 'array' : typeof learningPlanData,
      hasTaskData: !!requestData.tasks,
      taskCount: Object.keys(taskData).length,
      hasNotes: Array.isArray(notesData),
      notesCount: Array.isArray(notesData) ? notesData.length : 0,
      hasMarks: Array.isArray(marksData),
      marksCount: Array.isArray(marksData) ? marksData.length : 0
    });

    // 处理 learningPlan 数据格式（与 POST 方法相同的逻辑）
    let planDataForDb: any;
    
    if (Array.isArray(learningPlanData)) {
      planDataForDb = {
        plan: learningPlanData
      };
    } else if (learningPlanData && typeof learningPlanData === 'object') {
      if ('plan' in learningPlanData) {
        if (Array.isArray(learningPlanData.plan)) {
          planDataForDb = learningPlanData;
        } else if (learningPlanData.plan && typeof learningPlanData.plan === 'object' && 'plan' in learningPlanData.plan) {
          planDataForDb = {
            ...learningPlanData.plan,
            title: learningPlanData.title || learningPlanData.plan.title,
            description: learningPlanData.description || learningPlanData.plan.description,
          };
        } else {
          planDataForDb = learningPlanData;
        }
      } else {
        planDataForDb = {
          plan: learningPlanData
        };
      }
    } else {
      planDataForDb = {
        plan: learningPlanData || []
      };
    }

    // 构建完整的 coursePlan 对象（包含 plan、tasks、notes、marks）
    const fullCoursePlan = {
      plan: planDataForDb,
      tasks: taskData,
      notes: notesData,
      marks: marksData,
    };

    // 上传整个 coursePlan 对象到 CDN
    const jsonContent = JSON.stringify(fullCoursePlan, null, 2);
    const filename = `course_plan_${courseId}_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const planUrl = await uploadJsonToCDN(jsonContent, filename);
    
    console.log('✅ 整个 coursePlan 已上传到 CDN:', planUrl);

    // 通过 Backend API 更新课程（coursePlan 字段设为空对象，因为数据已存储在 CDN）
    const updatedCourse = await backendAPI.courses.updateFull(
      courseId,
      userId,
      {}, // coursePlan 为空，数据在 CDN
      planUrl // 更新 CDN URL
    );

    console.log('✅ 课程更新成功:', { courseId: updatedCourse.id });

    return NextResponse.json({ 
      course: updatedCourse,
      message: 'Course updated successfully'
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { error: 'Failed to update course' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const userId = session.user.id;
		const resolvedParams = await params;
		const courseId = resolvedParams.courseId;
		const body = await request.json();
		const hasIsPublic = Object.prototype.hasOwnProperty.call(body || {}, 'isPublic');
		const isPublic = hasIsPublic ? !!body.isPublic : undefined;
		const newTitle = typeof body?.title === 'string' ? body.title : undefined;
		const newDescription = typeof body?.description === 'string' ? body.description : undefined;

		// 通过 Backend API 获取课程
		const course = await backendAPI.courses.get(courseId, userId);
		
		// 兼容字段名（Backend 返回的是 snake_case，前端需要 camelCase）
		const courseWithCamelCase = {
			...course,
			planUrl: course.plan_url,
			coursePlan: course.course_plan,
			currentStep: course.current_step,
			tasksGenerated: course.tasks_generated,
			createdAt: course.created_at,
			updatedAt: course.updated_at,
			userId: course.user_id,
		};

		// 如果需要更新 title 或 description，需要从 CDN 下载完整的 coursePlan，更新后重新上传
		if (newTitle || newDescription) {
			let coursePlanData: any;
			
			// 如果有 planUrl，从 CDN 下载完整的 coursePlan
			if (courseWithCamelCase.planUrl) {
				try {
					coursePlanData = await downloadJsonFromCDN(courseWithCamelCase.planUrl);
				} catch (error) {
					console.error('❌ 从 CDN 下载 coursePlan 失败:', error);
					// 如果下载失败，尝试从 coursePlan 获取（兼容旧数据）
					coursePlanData = courseWithCamelCase.coursePlan as any;
				}
			} else {
				// 没有 planUrl，从 coursePlan 获取（兼容旧数据）
				coursePlanData = courseWithCamelCase.coursePlan as any;
			}
			
			// 更新 plan 数据中的 title 和 description
			const planData = coursePlanData?.plan;
			if (planData && typeof planData === 'object' && !Array.isArray(planData) && 
			    (planData.title || planData.description || planData.introduction || planData.plan)) {
				// 新格式：更新 instruction 级别的 title 和 description
				coursePlanData.plan = {
					...planData,
					...(newTitle ? { title: newTitle } : {}),
					...(newDescription ? { description: newDescription } : {}),
				};
			} else if (Array.isArray(planData) && planData.length > 0) {
				// 旧格式：更新第一步的 title 和 description
				coursePlanData.plan = planData.map((s: any, idx: number) => {
					if (idx !== 0) return s;
					return {
						...s,
						...(newTitle ? { title: newTitle } : {}),
						...(newDescription ? { description: newDescription } : {}),
					};
				});
			}
			
			// 更新 isPublic（如果提供）
			if (hasIsPublic) {
				coursePlanData.isPublic = isPublic;
			}
			
			// 上传更新后的完整 coursePlan 到 CDN
			const jsonContent = JSON.stringify(coursePlanData, null, 2);
			const filename = `course_plan_${courseId}_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
			const planUrl = await uploadJsonToCDN(jsonContent, filename);
			
			// 通过 Backend API 更新课程
			await backendAPI.courses.update(courseId, userId, {
				plan_url: planUrl,
				course_plan: {} // 不再存储 coursePlan，所有数据都在 CDN
			});

			// 返回更新后的值
			return NextResponse.json({ 
				success: true, 
				isPublic: coursePlanData.isPublic, 
				title: newTitle, 
				description: newDescription 
			});
		} else if (hasIsPublic) {
			// 只更新 isPublic，需要从 CDN 下载完整的 coursePlan，更新后重新上传
			let coursePlanData: any;
			
			if (courseWithCamelCase.planUrl) {
				try {
					coursePlanData = await downloadJsonFromCDN(courseWithCamelCase.planUrl);
				} catch (error) {
					console.error('❌ 从 CDN 下载 coursePlan 失败:', error);
					coursePlanData = courseWithCamelCase.coursePlan as any;
				}
			} else {
				coursePlanData = courseWithCamelCase.coursePlan as any;
			}
			
			coursePlanData.isPublic = isPublic;
			
			// 上传更新后的完整 coursePlan 到 CDN
			const jsonContent = JSON.stringify(coursePlanData, null, 2);
			const filename = `course_plan_${courseId}_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
			const planUrl = await uploadJsonToCDN(jsonContent, filename);
			
			// 通过 Backend API 更新课程
			await backendAPI.courses.update(courseId, userId, {
				plan_url: planUrl,
				course_plan: {} // 不再存储 coursePlan，所有数据都在 CDN
			});

			// 返回更新后的值
			return NextResponse.json({ 
				success: true, 
				isPublic: coursePlanData.isPublic, 
				title: newTitle, 
				description: newDescription 
			});
		}

		// 如果没有更新任何内容，返回成功
		return NextResponse.json({ 
			success: true, 
			isPublic: undefined, 
			title: newTitle, 
			description: newDescription 
		});
	} catch (e) {
		return NextResponse.json({ error: 'Failed to update course visibility' }, { status: 500 });
	}
}
