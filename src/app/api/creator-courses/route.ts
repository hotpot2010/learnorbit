import { getDb } from '@/db';
import { creatorCourses, userCourses, user } from '@/db/schema';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { isCreatorEmail, generateCourseSlug } from '@/lib/creator-utils';

// 创建创作者课程映射
export async function POST(request: NextRequest) {
	try {
		const { courseId, title, description } = await request.json();

		if (!courseId || !title) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
		}

		const db = await getDb();

		// 获取课程信息和创作者信息
		const courseData = await db
			.select({
				courseId: userCourses.id,
				userId: userCourses.userId,
				coursePlan: userCourses.coursePlan,
				userName: user.name,
				userEmail: user.email,
				isCreator: user.isCreator,
			})
			.from(userCourses)
			.innerJoin(user, eq(userCourses.userId, user.id))
			.where(eq(userCourses.id, courseId))
			.limit(1);

		if (!courseData.length) {
			return NextResponse.json({ error: 'Course not found' }, { status: 404 });
		}

		const course = courseData[0];

		// 检查是否为创作者
		const isCreatorAccount = course.isCreator || isCreatorEmail(course.userEmail || '');
		if (!isCreatorAccount) {
			return NextResponse.json({ error: 'Only creators can create clean URLs' }, { status: 403 });
		}

		// 检查课程是否已公开
		const isPublic = course.coursePlan?.isPublic === true;
		if (!isPublic) {
			return NextResponse.json({ error: 'Course must be public' }, { status: 400 });
		}

		// 生成简洁slug
		const slug = generateCourseSlug(title, course.userId, true);

		// 检查slug是否已存在
		const existing = await db
			.select()
			.from(creatorCourses)
			.where(eq(creatorCourses.slug, slug))
			.limit(1);

		if (existing.length > 0) {
			return NextResponse.json({ error: 'URL slug already exists' }, { status: 409 });
		}

		// 创建创作者课程映射
		const newCreatorCourse = await db
			.insert(creatorCourses)
			.values({
				slug,
				courseId,
				creatorId: course.userId,
				title,
				description: description || '',
				isActive: true,
			})
			.returning();

		console.log('✅ Created creator course mapping:', {
			slug,
			courseId,
			creatorId: course.userId,
			title
		});

		return NextResponse.json({
			success: true,
			creatorCourse: newCreatorCourse[0],
			url: `/study/${slug}`
		});

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

		const db = await getDb();

		const creatorCourseList = await db
			.select()
			.from(creatorCourses)
			.where(and(
				eq(creatorCourses.creatorId, creatorId),
				eq(creatorCourses.isActive, true)
			))
			.orderBy(creatorCourses.createdAt);

		return NextResponse.json({
			success: true,
			courses: creatorCourseList
		});

	} catch (error) {
		console.error('❌ Get creator courses error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
