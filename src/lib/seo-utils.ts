/**
 * SEO utilities for generating dynamic metadata and structured data
 */

import { generateSEOMetadata } from './seo';
import type { Metadata } from 'next';

/**
 * Generate course page metadata
 */
export function generateCourseMetadata({
  title,
  description,
  slug,
  category,
  difficulty,
  tags = [],
}: {
  title: string;
  description: string;
  slug: string;
  category?: string;
  difficulty?: string;
  tags?: string[];
}): Metadata {
  const keywords = [
    'AI课程',
    '在线学习',
    title,
    category,
    difficulty,
    ...tags,
  ].filter(Boolean) as string[];

  return generateSEOMetadata({
    title,
    description,
    keywords,
    canonical: `/course/${slug}`,
    type: 'article',
  });
}

/**
 * Generate blog post metadata
 */
export function generateBlogMetadata({
  title,
  description,
  slug,
  publishedAt,
  updatedAt,
  author,
  tags = [],
  category,
}: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  tags?: string[];
  category?: string;
}): Metadata {
  const keywords = [
    'AI学习',
    '技术博客',
    '人工智能',
    category,
    ...tags,
  ].filter(Boolean) as string[];

  return generateSEOMetadata({
    title,
    description,
    keywords,
    canonical: `/blog/${slug}`,
    type: 'article',
    publishedTime: publishedAt,
    modifiedTime: updatedAt,
    author,
  });
}

/**
 * Generate category page metadata
 */
export function generateCategoryMetadata({
  name,
  description,
  slug,
  courseCount,
}: {
  name: string;
  description: string;
  slug: string;
  courseCount?: number;
}): Metadata {
  const title = `${name} - AI课程分类`;
  const enhancedDescription = courseCount 
    ? `${description} 共${courseCount}门课程，助您掌握${name}技能。`
    : description;

  return generateSEOMetadata({
    title,
    description: enhancedDescription,
    keywords: [name, 'AI课程', '在线学习', '技能培训'],
    canonical: `/category/${slug}`,
  });
}

/**
 * Generate search results metadata
 */
export function generateSearchMetadata(query: string, resultCount?: number): Metadata {
  const title = `搜索"${query}"的结果`;
  const description = resultCount 
    ? `找到${resultCount}个与"${query}"相关的课程和内容`
    : `搜索"${query}"相关的AI课程和学习资源`;

  return generateSEOMetadata({
    title,
    description,
    keywords: [query, 'AI课程搜索', '在线学习'],
    canonical: `/search?q=${encodeURIComponent(query)}`,
    noIndex: true, // 搜索结果页面通常不需要被索引
  });
}

/**
 * Generate user profile metadata (for public profiles)
 */
export function generateProfileMetadata({
  username,
  bio,
  courseCount,
}: {
  username: string;
  bio?: string;
  courseCount?: number;
}): Metadata {
  const title = `${username} - 学习者档案`;
  const description = bio || `${username}在Aitutorly的学习档案${courseCount ? `，已学习${courseCount}门课程` : ''}`;

  return generateSEOMetadata({
    title,
    description,
    keywords: ['学习者档案', 'AI学习', '在线教育'],
    canonical: `/profile/${username}`,
  });
}

/**
 * Common page titles for better consistency
 */
export const PAGE_TITLES = {
  HOME: 'AI驱动的个性化学习平台',
  COURSES: '全部课程 - AI学习资源',
  PRICING: '定价方案 - 选择适合您的学习计划',
  CONTACT: '联系我们 - 获取学习支持',
  LOGIN: '登录 - 开始您的AI学习之旅',
  REGISTER: '注册 - 加入Aitutorly学习社区',
  ABOUT: '关于我们 - Aitutorly AI学习平台',
  FAQ: '常见问题 - 学习指南与帮助',
  PRIVACY: '隐私政策 - 保护您的学习数据',
  TERMS: '服务条款 - 学习平台使用协议',
} as const;

/**
 * Helper function to truncate text for meta descriptions
 */
export function truncateDescription(text: string, maxLength = 155): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + '...';
}

/**
 * Helper function to generate breadcrumb JSON-LD
 */
export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}