import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';
import type { CreatorCourseResponse } from '@/lib/backend-api';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
	try {
		const { slug } = await params;

		console.log('🎨 Creator course API:', { slug });

		// 通过 Backend API 获取创作者课程
		const result: CreatorCourseResponse = await backendAPI.creatorCourses.getBySlug(slug);

		console.log('✅ Creator course found:', {
			slug,
			title: result.course?.creatorCourse?.title,
			creator: result.course?.creator?.name
		});

		return NextResponse.json(result);

	} catch (error) {
		console.error('❌ Creator course API error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
