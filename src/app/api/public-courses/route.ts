import { getDb } from '@/db';
import { userCourses, creatorCourses } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { downloadJsonFromCDN } from '@/lib/cdn-utils';
import { eq, and, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const search = searchParams.get('search')?.toLowerCase() || '';

		// 添加重试机制处理连接关闭错误
		let db;
		let rows;
		let retries = 3;
		
		while (retries > 0) {
			try {
				db = await getDb();
				
				// 优化：先从 creator_courses 表获取所有活跃的课程 ID
				// 这些课程肯定是公开的（因为创建 creator_courses 时会检查 isPublic）
				const activeCreatorCourses = await db
					.select({ courseId: creatorCourses.courseId })
					.from(creatorCourses)
					.where(eq(creatorCourses.isActive, true));
				
				const courseIds = activeCreatorCourses.map(cc => cc.courseId);
				
				if (courseIds.length === 0) {
					rows = [];
					break;
				}
				
				// 只查询这些课程 ID 对应的课程
				rows = await db
					.select()
					.from(userCourses)
					.where(inArray(userCourses.id, courseIds));
				
				break; // 成功则退出循环
			} catch (error: any) {
				retries--;
				if (error?.code === 'CONNECTION_CLOSED' || error?.message?.includes('CONNECTION_CLOSED')) {
					if (retries > 0) {
						console.log(`⚠️ Connection closed, retrying... (${retries} attempts left)`);
						// 等待一小段时间后重试
						await new Promise(resolve => setTimeout(resolve, 1000));
						continue;
					}
				}
				throw error; // 非连接关闭错误或重试次数用完，抛出错误
			}
		}
		
		// 从 CDN 下载 coursePlan 数据（这些课程肯定在 creator_courses 中，所以肯定是公开的）
		// 但我们仍然需要下载 coursePlan 来获取标题、描述等信息
		const publicCourses = await Promise.all(
			rows.map(async (r: any) => {
				// 如果有 planUrl，从 CDN 下载
				if (r.planUrl) {
					try {
						const coursePlanData = await downloadJsonFromCDN(r.planUrl);
						return { ...r, coursePlanData };
					} catch (error) {
						console.error(`❌ 从 CDN 下载课程 ${r.id} 的 coursePlan 失败:`, error);
						// 如果下载失败，使用数据库数据
						return r;
					}
				}
				
				// 没有 planUrl，使用数据库数据
				return r;
			})
		);
		
		// 所有课程都是有效的（因为来自 creator_courses）
		const validPublicCourses = publicCourses;

		// 规范化输出，供首页卡片使用
		const normalized = validPublicCourses.map((c: any) => {
			// 优先使用从 CDN 下载的数据，否则使用数据库数据
			const coursePlanData = c.coursePlanData || c.coursePlan;
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
			
			// 优先使用 instruction 中的标题和描述，回退到第一步的信息
			const title = coursePlan.title || planSteps[0]?.title || 'Untitled Course';
			const description = coursePlan.description || planSteps[0]?.description || 'No description';
			
			const firstVideo = planSteps[0]?.videos?.[0];
			const coverImage = firstVideo?.cover || '/images/blog/post-1.png';
			const rating = 4; // 默认4星评级
			const type = planSteps[0]?.type || 'theory';
			const difficulty = (type === 'coding' ? 'intermediate' : 'beginner') as 'beginner'|'intermediate'|'advanced';
			return {
				id: c.id,
				title,
				description,
				coverImage,
				rating,
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