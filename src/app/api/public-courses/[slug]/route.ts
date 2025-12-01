import { getDb } from '@/db';
import { userCourses } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { downloadJsonFromCDN } from '@/lib/cdn-utils';

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
			console.log('❌ Invalid slug format:', { slug, decoded });
			return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
		}
		const titlePartRaw = decoded.slice(0, lastDash);
		const titlePart = slugifyTitle(titlePartRaw);
		const userId = decoded.slice(lastDash + 1);

		console.log('🔍 Slug API:', { titlePart, userId });

		const db = await getDb();
		// 先按 userId 过滤，再在内存中过滤标题匹配（标题存于 JSONB）
		const rows = await db.select().from(userCourses).where(eq(userCourses.userId, userId));
		
		// 检查每个课程是否匹配（需要从 CDN 或数据库获取 isPublic）
		const matches = await Promise.all(
			rows.map(async (r: any) => {
				// 获取 coursePlan 数据（优先从 CDN，否则从数据库）
				let coursePlanData: any;
				if (r.planUrl) {
					try {
						coursePlanData = await downloadJsonFromCDN(r.planUrl);
					} catch (error) {
						console.error(`❌ 从 CDN 下载课程 ${r.id} 失败:`, error);
						coursePlanData = r.coursePlan;
					}
				} else {
					coursePlanData = r.coursePlan;
				}
				
				const rawPlan = coursePlanData?.plan;
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
				
				// 优先使用 instruction 中的标题，回退到第一步的标题
				const titleInDb = coursePlan.title || planSteps[0]?.title || '';
				const slugifiedTitle = slugifyTitle(titleInDb);
				const isPublic = coursePlanData?.isPublic === true;
				const titleMatches = slugifiedTitle === titlePart;
				
				console.log('🔍 检查课程:', {
					id: r.id,
					format: Array.isArray(rawPlan) ? '旧格式' : '新格式',
					title: titleInDb,
					isPublic,
					titleMatches,
					match: isPublic && titleMatches
				});
				
				return isPublic && titleMatches ? { ...r, coursePlanData } : null;
			})
		);
		
		let match = matches.find((m): m is any => m !== null);
		
		// 回退：如果按 userId 未匹配，扫描全部公开课程匹配标题（取最新）
		if (!match) {
			console.log('🔄 开始全局搜索');
			const allRows = await db.select().from(userCourses);
			
			// 检查所有课程是否匹配（需要从 CDN 或数据库获取 isPublic）
			const candidates = await Promise.all(
				allRows.map(async (r: any) => {
					// 获取 coursePlan 数据（优先从 CDN，否则从数据库）
					let coursePlanData: any;
					if (r.planUrl) {
						try {
							coursePlanData = await downloadJsonFromCDN(r.planUrl);
						} catch (error) {
							coursePlanData = r.coursePlan;
						}
					} else {
						coursePlanData = r.coursePlan;
					}
					
					if (!(coursePlanData?.isPublic === true)) return null;
					
					const rawPlan = coursePlanData?.plan;
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
					
					// 优先使用 instruction 中的标题，回退到第一步的标题
					const titleInDb = coursePlan.title || planSteps[0]?.title || '';
					const titleMatches = slugifyTitle(titleInDb) === titlePart;
					
					return titleMatches ? { ...r, coursePlanData } : null;
				})
			);
			
			const validCandidates = candidates.filter((c): c is any => c !== null);
			if (validCandidates.length > 0) {
				validCandidates.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				match = validCandidates[0];
				console.log('✅ 全局匹配成功:', { id: match.id, userId: match.userId });
			} else {
				console.log('❌ 未找到匹配的公开课程');
			}
		}
		
		if (!match) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

		return NextResponse.json({ course: match }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to fetch public course by slug' }, { status: 500 });
	}
} 