import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
	try {
		const db = await getDb();
		// 获取全部课程，再在内存中过滤 isPublic（coursePlan 为 JSONB，避免复杂 where 语句）
		const rows = await db.select().from(userCourses);
		const publicCourses = rows.filter((r: any) => r.coursePlan && (r.coursePlan as any).isPublic === true);

		// 规范化输出，供首页卡片使用
		const normalized = publicCourses.map((c: any) => {
			const plan = c.coursePlan?.plan || [];
			const title = plan[0]?.title || 'Untitled Course';
			const description = plan[0]?.description || 'No description';
			const firstVideo = plan[0]?.videos?.[0];
			const coverImage = firstVideo?.cover || '/images/blog/post-1.png';
			const estimatedTime = firstVideo?.duration || 'Unknown';
			const type = plan[0]?.type || 'theory';
			const difficulty = (type === 'coding' ? 'intermediate' : 'beginner') as 'beginner'|'intermediate'|'advanced';
			return {
				id: c.id,
				title,
				description,
				coverImage,
				estimatedTime,
				difficulty,
				ownerId: c.userId,
				createdAt: c.createdAt,
			};
		});

		return NextResponse.json({ courses: normalized }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public courses' }, { status: 500 });
	}
} 