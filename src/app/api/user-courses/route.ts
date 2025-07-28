import { NextRequest, NextResponse } from 'next/server';
import { UserCourseRepository } from '@/lib/repositories/user-course-repository';
import { authClient } from '@/lib/auth-client';

const userCourseRepo = new UserCourseRepository();

// 获取用户所有课程
export async function GET(request: NextRequest) {
  try {
    // 从请求中获取用户身份验证信息
    const session = await authClient.getSession();
    if (!session?.data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.data.user.id;
    const courses = await userCourseRepo.getUserCourses(userId);
    
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Error fetching user courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' }, 
      { status: 500 }
    );
  }
}

// 创建新课程
export async function POST(request: NextRequest) {
  try {
    const session = await authClient.getSession();
    if (!session?.data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.data.user.id;
    const courseData = await request.json();
    
    const course = await userCourseRepo.createUserCourse(userId, courseData);
    
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' }, 
      { status: 500 }
    );
  }
} 