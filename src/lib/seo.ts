import type { Metadata } from 'next';
import { getBaseUrl } from './urls/urls';

interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
  canonical?: string;
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}

export function generateSEOMetadata({
  title,
  description = 'AITutorly is an AI-powered learning platform that builds personalized study plans, curates video lessons, and provides quizzes to boost your learning efficiency.',
  keywords = ['AI learning platform', 'personalized learning', 'adaptive learning', 'AI study plan', 'online courses', 'AI tutoring', 'study assistant', 'learn with AI', 'custom learning path', 'AI education tools'],
  ogImage,
  noIndex = false,
  canonical,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
}: SEOConfig = {}): Metadata {
  const baseUrl = getBaseUrl();
  const siteName = 'AITutorly';
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const defaultOgImage = `${baseUrl}/images/og-image.png`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    robots: noIndex ? 'noindex, nofollow' : 'index, follow',

    openGraph: {
      title: fullTitle,
      description,
      url: canonical ? `${baseUrl}${canonical}` : baseUrl,
      siteName,
      images: [
        {
          url: ogImage || defaultOgImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      locale: 'zh_CN',
      type: type as 'website',
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && type === 'article' && { authors: [author] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage || defaultOgImage],
      creator: '@aitutorly',
    },
    alternates: {
      canonical: canonical ? `${baseUrl}${canonical}` : baseUrl,
      languages: {
        'zh-CN': `${baseUrl}/zh`,
        'en-US': `${baseUrl}/en`,
      },
    },
    other: {
      'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
      'baidu-site-verification': process.env.BAIDU_SITE_VERIFICATION || '',
      'msvalidate.01': process.env.BING_SITE_VERIFICATION || '',
    },
    category: type === 'article' ? 'technology' : undefined,
  };
}

export const defaultSEO: Metadata = generateSEOMetadata({
  title: 'AITutorly | AI Learning Platform for Personalized Courses & Study Plans',
  description: 'AITutorly is an AI-powered learning platform that builds personalized study plans, curates video lessons, and provides quizzes to boost your learning efficiency.',
  keywords: [
    'AI learning platform',
    'personalized learning', 
    'adaptive learning',
    'AI study plan',
    'online courses',
    'AI tutoring',
    'study assistant',
    'learn with AI',
    'custom learning path',
    'AI education tools',
  ],
});
