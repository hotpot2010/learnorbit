import { NextRequest, NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const search = searchParams.get('search') || undefined;

		// 通过 Backend API 获取公开课程列表
		const result = await backendAPI.publicCourses.getList(search);

		const res = NextResponse.json(result, { status: 200 });
		// CDN/SWR 缓存：5分钟内命中缓存，后台 10 分钟内可复用旧数据
		res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
		return res;
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public courses' }, { status: 500 });
	}
} 