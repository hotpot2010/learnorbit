import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { creatorCourses, userCourses, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateCourseSlug, isCreatorEmail } from '@/lib/creator-utils';
import { getBaseUrl } from '@/lib/urls/urls';

interface StudyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { locale, id } = resolvedParams;
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://aitutorly.ai' : getBaseUrl();

  try {
    const db = await getDb();
    
    console.log('🔍 Generating metadata for course ID:', id);

    // 1. 首先尝试从创作者课程表中查找
    const creatorCourse = await db
      .select({
        slug: creatorCourses.slug,
        title: creatorCourses.title,
        description: creatorCourses.description,
        updatedAt: creatorCourses.updatedAt,
      })
      .from(creatorCourses)
      .where(eq(creatorCourses.slug, id))
      .limit(1);

    console.log('🔍 Creator course search result:', creatorCourse.length);

    if (creatorCourse.length > 0) {
      const course = creatorCourse[0];
      const courseUrl = `${baseUrl}/${locale}/study/${course.slug}`;
      
      console.log('✅ Found creator course:', course.title);

      return {
        title: `${course.title} - AI智能学习助手 | AiTutorly`,
        description: course.description || `通过AI智能助手学习${course.title}，个性化学习路径，互动式学习体验。`,
        keywords: `${course.title}, AI学习, 在线教育, 智能助手, 个性化学习`,
        authors: [{ name: 'AiTutorly' }],
        creator: 'AiTutorly',
        publisher: 'AiTutorly',
        formatDetection: {
          email: false,
          address: false,
          telephone: false,
        },
        metadataBase: new URL(baseUrl),
        alternates: {
          canonical: courseUrl,
          languages: {
            'en': `${baseUrl}/en/study/${course.slug}`,
            'zh': `${baseUrl}/zh/study/${course.slug}`,
          },
        },
        openGraph: {
          title: `${course.title} - AI智能学习助手`,
          description: course.description || `通过AI智能助手学习${course.title}，个性化学习路径，互动式学习体验。`,
          url: courseUrl,
          siteName: 'AiTutorly',
          locale: locale === 'zh' ? 'zh_CN' : 'en_US',
          type: 'article',
          images: [
            {
              url: `${baseUrl}/logo.png`,
              width: 1200,
              height: 630,
              alt: `${course.title} - AiTutorly`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${course.title} - AI智能学习助手`,
          description: course.description || `通过AI智能助手学习${course.title}，个性化学习路径，互动式学习体验。`,
          images: [`${baseUrl}/logo.png`],
          creator: '@aitutorly',
        },
        robots: {
          index: true,
          follow: true,
          nocache: false,
          googleBot: {
            index: true,
            follow: true,
            noimageindex: false,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
      };
    }

    // 2. 如果不是创作者课程，从用户课程表中查找
    const publicCourses = await db
      .select({
        id: userCourses.id,
        userId: userCourses.userId,
        coursePlan: userCourses.coursePlan,
        updatedAt: userCourses.updatedAt,
        userName: user.name,
        userEmail: user.email,
        isCreator: user.isCreator,
      })
      .from(userCourses)
      .innerJoin(user, eq(userCourses.userId, user.id));

    console.log('🔍 Searching in public courses, total:', publicCourses.length);

    // 查找匹配的课程
    for (const course of publicCourses) {
      const coursePlan = course.coursePlan as any;
      if (!coursePlan || !coursePlan.isPublic) continue;

      const rawPlan = coursePlan.plan;
      let title = '';

      // 兼容新旧格式
      if (rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan) && rawPlan.title) {
        title = rawPlan.title;
      } else if (Array.isArray(rawPlan) && rawPlan.length > 0) {
        title = rawPlan[0]?.title || 'Untitled Course';
      } else {
        title = 'Untitled Course';
      }

      const isCreatorAccount = Boolean(course.isCreator || (course.userEmail && isCreatorEmail(course.userEmail)));
      const courseSlug = generateCourseSlug(title, course.userId, isCreatorAccount);

      if (courseSlug === id) {
        const courseUrl = `${baseUrl}/${locale}/study/${courseSlug}`;
        const description = rawPlan?.description || rawPlan?.introduction || `通过AI智能助手学习${title}，个性化学习路径，互动式学习体验。`;
        
        console.log('✅ Found matching public course:', title);

        return {
          title: `${title} - AI智能学习助手 | AiTutorly`,
          description,
          keywords: `${title}, AI学习, 在线教育, 智能助手, 个性化学习`,
          authors: [{ name: 'AiTutorly' }],
          creator: 'AiTutorly',
          publisher: 'AiTutorly',
          formatDetection: {
            email: false,
            address: false,
            telephone: false,
          },
          metadataBase: new URL(baseUrl),
          alternates: {
            canonical: courseUrl,
            languages: {
              'en': `${baseUrl}/en/study/${courseSlug}`,
              'zh': `${baseUrl}/zh/study/${courseSlug}`,
            },
          },
          openGraph: {
            title: `${title} - AI智能学习助手`,
            description,
            url: courseUrl,
            siteName: 'AiTutorly',
            locale: locale === 'zh' ? 'zh_CN' : 'en_US',
            type: 'article',
            images: [
              {
                url: `${baseUrl}/logo.png`,
                width: 1200,
                height: 630,
                alt: `${title} - AiTutorly`,
              },
            ],
          },
          twitter: {
            card: 'summary_large_image',
            title: `${title} - AI智能学习助手`,
            description,
            images: [`${baseUrl}/logo.png`],
            creator: '@aitutorly',
          },
          robots: {
            index: true,
            follow: true,
            nocache: false,
            googleBot: {
              index: true,
              follow: true,
              noimageindex: false,
              'max-video-preview': -1,
              'max-image-preview': 'large',
              'max-snippet': -1,
            },
          },
        };
      }
    }

    // 如果找不到课程，返回404
    notFound();
  } catch (error) {
    console.error('❌ Error generating metadata for course:', error);
    console.error('❌ Course ID:', id);

    // 发生错误时返回基本元数据，但仍允许索引
    return {
      title: 'AI智能学习助手 | AiTutorly',
      description: '通过AI智能助手进行个性化学习，打造专属学习路径。',
      robots: {
        index: true,
        follow: true,
      },
    };
  }
}

export default function StudyLayout({ children, params }: StudyLayoutProps) {
  return <>{children}</>;
}
