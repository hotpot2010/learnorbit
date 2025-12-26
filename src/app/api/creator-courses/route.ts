import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

// 创建创作者课程映射
export async function POST(request: NextRequest) {
	try {
		const { courseId, title, description } = await request.json();

		if (!courseId || !title) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
		}

		// 通过 Backend API 创建创作者课程映射
		const result = await backendAPI.creatorCourses.create(courseId, title, description);

		console.log('✅ Created creator course mapping:', result);

		return NextResponse.json(result);

	} catch (error) {
		console.error('❌ Creator course creation error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

// 获取创作者的所有课程
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const creatorId = searchParams.get('creatorId');

		if (!creatorId) {
			return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 });
		}

		// 通过 Backend API 获取创作者的所有课程
		const result = await backendAPI.creatorCourses.getCreatorCourses(creatorId);

		return NextResponse.json(result);

	} catch (error) {
		console.error('❌ Get creator courses error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
