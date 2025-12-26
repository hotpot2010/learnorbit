import { NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

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
		
		// Next.js 13+ 的 params 可能已经是解码后的值，但如果包含 % 字符，可能是编码的
		// 需要处理可能的双重编码情况
		let decoded = slug;
		try {
			// 如果 slug 包含编码字符，尝试解码（可能解码多次）
			while (decoded.includes('%')) {
				const newDecoded = decodeURIComponent(decoded);
				// 如果解码后没有变化，说明已经解码完成
				if (newDecoded === decoded) {
					break;
				}
				decoded = newDecoded;
			}
		} catch (e) {
			// 解码失败，使用原始值
			console.warn('⚠️ Failed to decode slug:', e);
		}
		
		// 解析 slug: [title]-[userId]
		const lastDash = decoded.lastIndexOf('-');
		if (lastDash <= 0) {
			console.log('❌ Invalid slug format:', { slug, decoded });
			return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
		}
		const titlePartRaw = decoded.slice(0, lastDash);
		const titlePart = slugifyTitle(titlePartRaw);
		const userId = decoded.slice(lastDash + 1);

		console.log('🔍 Slug API:', { originalSlug: slug, decoded, titlePart, userId });

		// 通过 Backend API 获取公开课程
		// 传递解码后的 slug，Backend API 会正确处理
		const result = await backendAPI.courses.getPublicCourse(decoded);
		
		return NextResponse.json(result, { status: 200 });
	} catch (e) {
		console.error('❌ Error fetching public course:', e);
		return NextResponse.json({ error: 'Failed to fetch public course by slug' }, { status: 500 });
	}
} 