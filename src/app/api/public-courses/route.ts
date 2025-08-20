import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const search = searchParams.get('search')?.toLowerCase() || '';

		const db = await getDb();
		// 获取全部课程，再在内存中过滤 isPublic（coursePlan 为 JSONB，避免复杂 where 语句）
		const rows = await db.select().from(userCourses);
		let publicCourses = rows.filter((r: any) => r.coursePlan && (r.coursePlan as any).isPublic === true);

		// 规范化输出，供首页卡片使用
		const normalized = publicCourses.map((c: any) => {
			const rawPlan = c.coursePlan?.plan;
			let coursePlan: any;
			let planSteps: any[];
			
			// 兼容新旧格式
			if (rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan) && (rawPlan.title || rawPlan.description || rawPlan.introduction || rawPlan.plan)) {
				// 新格式：rawPlan 是包含 title、description、plan 的对象
				coursePlan = rawPlan;
				planSteps = rawPlan.plan || [];
			} else {
				// 旧格式：rawPlan 直接是步骤数组
				coursePlan = {};
				planSteps = Array.isArray(rawPlan) ? rawPlan : [];
			}
			
			// 优先使用 instruction 中的标题和描述，回退到第一步的信息
			const title = coursePlan.title || planSteps[0]?.title || 'Untitled Course';
			const description = coursePlan.description || planSteps[0]?.description || 'No description';
			
			const firstVideo = planSteps[0]?.videos?.[0];
			const coverImage = firstVideo?.cover || '/images/blog/post-1.png';
			const estimatedTime = firstVideo?.duration || 'Unknown';
			const type = planSteps[0]?.type || 'theory';
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

		// 如果有搜索参数，进行客户端搜索过滤
		const filteredCourses = search 
			? normalized.filter(course => 
				course.title.toLowerCase().includes(search) ||
				course.description.toLowerCase().includes(search)
			)
			: normalized;

		// 按创建时间降序排序
		filteredCourses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		const res = NextResponse.json({ courses: filteredCourses }, { status: 200 });
		// CDN/SWR 缓存：5分钟内命中缓存，后台 10 分钟内可复用旧数据
		res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
		return res;
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public courses' }, { status: 500 });
	}
} 