import { NextRequest, NextResponse } from 'next/server';
// TODO: 重新启用当Supabase配置完成后
// import { UserCourseRepository } from '@/lib/repositories/user-course-repository';
// import { authClient } from '@/lib/auth-client';

// const userCourseRepo = new UserCourseRepository();

// 创建新课程 - 暂时返回模拟数据
export async function POST(request: NextRequest) {
  try {
    // TODO: 重新启用用户验证和数据库操作
    // const session = await authClient.getSession();
    // if (!session?.data?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // const userId = session.data.user.id;
    const courseData = await request.json();
    
    // const course = await userCourseRepo.createUserCourse(userId, courseData);
    const mockCourse = {
      id: `course-${Date.now()}`,
      ...courseData,
      created_at: new Date().toISOString()
    };
    
    return NextResponse.json({ course: mockCourse }, { status: 201 });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' }, 
      { status: 500 }
    );
  }
}