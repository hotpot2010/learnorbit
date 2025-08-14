import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
	try {
		const { slug } = await params;
		// 解析 slug: [title]-[userId]
		const lastDash = slug.lastIndexOf('-');
		if (lastDash <= 0) {
			return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
		}
		const titlePart = decodeURIComponent(slug.slice(0, lastDash));
		const userId = slug.slice(lastDash + 1);

		const db = await getDb();
		// 先按 userId 过滤，再在内存中过滤标题匹配（标题存于 JSONB）
		const rows = await db.select().from(userCourses).where(eq(userCourses.userId, userId));
		const match = rows.find((r: any) => {
			const plan = r.coursePlan?.plan || [];
			return (r.coursePlan?.isPublic === true) && plan[0]?.title === titlePart;
		});
		if (!match) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

		return NextResponse.json({ course: match }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public course by slug' }, { status: 500 });
	}
} 