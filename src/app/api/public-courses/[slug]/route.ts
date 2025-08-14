import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

function slugifyTitle(title: string): string {
	return (title || '')
		.toString()
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
	try {
		const { slug } = await params;
		// 解析 slug: [title]-[userId]
		const decoded = decodeURIComponent(slug);
		const lastDash = decoded.lastIndexOf('-');
		if (lastDash <= 0) {
			return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
		}
		const titlePartRaw = decoded.slice(0, lastDash);
		const titlePart = slugifyTitle(titlePartRaw);
		const userId = decoded.slice(lastDash + 1);

		const db = await getDb();
		// 先按 userId 过滤，再在内存中过滤标题匹配（标题存于 JSONB）
		const rows = await db.select().from(userCourses).where(eq(userCourses.userId, userId));
		let match = rows.find((r: any) => {
			const plan = r.coursePlan?.plan || [];
			const titleInDb = plan[0]?.title || '';
			return (r.coursePlan?.isPublic === true) && slugifyTitle(titleInDb) === titlePart;
		});
		
		// 回退：如果按 userId 未匹配，扫描全部公开课程匹配标题（取最新）
		if (!match) {
			const allRows = await db.select().from(userCourses);
			const candidates = allRows.filter((r: any) => {
				if (!(r.coursePlan?.isPublic === true)) return false;
				const plan = r.coursePlan?.plan || [];
				const titleInDb = plan[0]?.title || '';
				return slugifyTitle(titleInDb) === titlePart;
			});
			if (candidates.length > 0) {
				candidates.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				match = candidates[0];
			}
		}
		
		if (!match) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

		return NextResponse.json({ course: match }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public course by slug' }, { status: 500 });
	}
} 