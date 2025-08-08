import type { Metadata } from 'next';
import { getBaseUrl } from './urls/urls';

interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
  canonical?: string;
}

export function generateSEOMetadata({
  title,
  description = 'Aitutorly - AI驱动的个性化学习平台，为您量身定制最适合的学习路径',
  keywords = ['AI学习', '个性化教育', '在线学习', '人工智能', '学习平台'],
  ogImage,
  noIndex = false,
  canonical,
}: SEOConfig = {}): Metadata {
  const baseUrl = getBaseUrl();
  const siteName = 'Aitutorly';
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
      url: baseUrl,
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
      type: 'website',
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
    },
  };
}

export const defaultSEO: Metadata = generateSEOMetadata({
  title: 'AI驱动的个性化学习平台',
  description: 'Aitutorly利用人工智能技术，为每位学习者提供个性化的学习体验。智能推荐学习内容，优化学习路径，让学习更高效、更有趣。',
  keywords: [
    'AI学习平台',
    '个性化教育',
    '人工智能学习',
    '在线课程',
    '智能学习',
    '自适应学习',
    '学习助手',
    'AI tutoring',
  ],
});
