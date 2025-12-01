import { getDb } from '@/db';
import { creatorCourses, userCourses, user } from '@/db/schema';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { downloadJsonFromCDN } from '@/lib/cdn-utils';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
	try {
		const { slug } = await params;

		console.log('🎨 Creator course API:', { slug });

		const db = await getDb();

		// 查找创作者课程
		const creatorCourse = await db
			.select({
				id: creatorCourses.id,
				slug: creatorCourses.slug,
				title: creatorCourses.title,
				description: creatorCourses.description,
				courseId: creatorCourses.courseId,
				creatorId: creatorCourses.creatorId,
				isActive: creatorCourses.isActive,
				createdAt: creatorCourses.createdAt,
				updatedAt: creatorCourses.updatedAt,
				// 关联课程数据
				coursePlan: userCourses.coursePlan,
				planUrl: userCourses.planUrl,
				currentStep: userCourses.currentStep,
				status: userCourses.status,
				// 关联创作者信息
				creatorName: user.name,
				creatorEmail: user.email,
				creatorImage: user.image,
			})
			.from(creatorCourses)
			.innerJoin(userCourses, eq(creatorCourses.courseId, userCourses.id))
			.innerJoin(user, eq(creatorCourses.creatorId, user.id))
			.where(and(
				eq(creatorCourses.slug, slug),
				eq(creatorCourses.isActive, true)
			))
			.limit(1);

		if (!creatorCourse.length) {
			console.log('❌ Creator course not found:', { slug });
			return NextResponse.json({ error: 'Course not found' }, { status: 404 });
		}

		const course = creatorCourse[0];

		// 确保课程是公开的（需要从 CDN 或数据库检查 isPublic）
		let coursePlanData: any = course.coursePlan;
		if (course.planUrl) {
			try {
				coursePlanData = await downloadJsonFromCDN(course.planUrl);
			} catch (error) {
				console.error(`❌ 从 CDN 下载课程 ${course.courseId} 的 coursePlan 失败:`, error);
				// 如果下载失败，使用数据库数据
				coursePlanData = course.coursePlan;
			}
		}
		
		const isPublic = coursePlanData?.isPublic === true;
		if (!isPublic) {
			console.log('❌ Creator course is not public:', { slug });
			return NextResponse.json({ error: 'Course not available' }, { status: 404 });
		}

		console.log('✅ Creator course found:', {
			slug,
			title: course.title,
			creator: course.creatorName
		});

		return NextResponse.json({
			success: true,
			course: {
				id: course.courseId,
				userId: course.creatorId,
				coursePlan: coursePlanData, // 使用从 CDN 下载的数据或数据库数据
				currentStep: course.currentStep,
				status: course.status,
				createdAt: course.createdAt,
				updatedAt: course.updatedAt,
				// 创作者信息
				creator: {
					id: course.creatorId,
					name: course.creatorName,
					email: course.creatorEmail,
					image: course.creatorImage,
				},
				// 创作者课程信息
				creatorCourse: {
					id: course.id,
					slug: course.slug,
					title: course.title,
					description: course.description,
					isActive: course.isActive,
				}
			}
		});

	} catch (error) {
		console.error('❌ Creator course API error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
