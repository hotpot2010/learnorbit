import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface StudyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}

// 获取课程信息的函数
async function getCourseInfo(slug: string) {
  try {
    // 首先尝试创作者课程API
    const creatorResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://aitutorly.ai'}/api/creator-courses/${encodeURIComponent(slug)}`, {
      cache: 'no-store' // 确保获取最新数据
    });

    if (creatorResponse.ok) {
      return await creatorResponse.json();
    }

    // 回退到普通公共课程API
    const publicResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://aitutorly.ai'}/api/public-courses/${encodeURIComponent(slug)}`, {
      cache: 'no-store'
    });

    if (publicResponse.ok) {
      return await publicResponse.json();
    }

    return null;
  } catch (error) {
    console.error('获取课程信息失败:', error);
    return null;
  }
}

// 生成动态元数据
export async function generateMetadata({ params }: StudyLayoutProps): Promise<Metadata> {
  const { locale, id } = await params;

  // 获取翻译
  const t = await getTranslations({ locale, namespace: 'LearningPlatform.study' });
  const tCommon = await getTranslations({ locale, namespace: 'Common' });

  // 获取课程信息
  const courseData = await getCourseInfo(id);

  if (!courseData) {
    return {
      title: t('notFound.title'),
      description: t('notFound.description'),
    };
  }

  const { course } = courseData;
  const title = course.title || t('defaultTitle');
  const description = course.description || t('defaultDescription');
  const siteName = tCommon('siteName');

  // 构建完整的URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aitutorly.ai';
  const fullUrl = `${baseUrl}/${locale}/study/${id}`;
  const imageUrl = course.coverImage ? `${baseUrl}${course.coverImage}` : `${baseUrl}/logo.png`;

  return {
    title: `${title} - ${siteName}`,
    description: description,
    keywords: [
      title,
      'AI学习',
      '在线课程',
      '人工智能教育',
      'AI tutorial',
      'online learning',
      'artificial intelligence'
    ].join(', '),
    authors: [{ name: course.ownerName || siteName }],
    creator: course.ownerName || siteName,
    publisher: siteName,
    openGraph: {
      title: `${title} - ${siteName}`,
      description: description,
      url: fullUrl,
      siteName: siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        }
      ],
      locale: locale,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - ${siteName}`,
      description: description,
      images: [imageUrl],
      creator: '@aitutorly',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: fullUrl,
      languages: {
        'en': `${baseUrl}/en/study/${id}`,
        'zh': `${baseUrl}/zh/study/${id}`,
      },
    },
  };
}

export default function StudyLayout({ children }: StudyLayoutProps) {
  return <>{children}</>;
}
