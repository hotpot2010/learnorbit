import Container from '@/components/layout/container';
import { CourseInputSection } from '@/components/learning/course-input-section';
import { CourseRecommendationWithNavigation } from '@/components/learning/course-recommendation-with-navigation';
import { constructMetadata } from '@/lib/metadata';
import { getCanonicalUrl } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { getDb } from '@/db';
import { userCourses, creatorCourses } from '@/db/schema';
import { downloadJsonFromCDN } from '@/lib/cdn-utils';
import { eq, inArray } from 'drizzle-orm';

type PublicCourseCard = {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  rating: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  ownerId: string;
  createdAt?: string;
};

const getPublicCoursesCached = unstable_cache(async (): Promise<PublicCourseCard[]> => {
  const db = await getDb();
  
  // 优化：先从 creator_courses 表获取所有活跃的课程 ID
  // 这些课程肯定是公开的（因为创建 creator_courses 时会检查 isPublic）
  const activeCreatorCourses = await db
    .select({ courseId: creatorCourses.courseId })
    .from(creatorCourses)
    .where(eq(creatorCourses.isActive, true));
  
  const courseIds = activeCreatorCourses.map(cc => cc.courseId);
  
  if (courseIds.length === 0) {
    return [];
  }
  
  // 只查询这些课程 ID 对应的课程
  const rows = await db
    .select()
    .from(userCourses)
    .where(inArray(userCourses.id, courseIds));
  
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
  
  // 映射为卡片数据
  return publicCourses.map((c: any) => {
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
      return { id: c.id, title, description, coverImage, rating, difficulty, ownerId: c.userId, createdAt: c.createdAt };
    });
}, ['public-courses'], { revalidate: 300, tags: ['public-courses'] });

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#metadata-api
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LearningPlatform' });

  return constructMetadata({
    title: t('meta.title'),
    description: t('meta.description'),
    canonicalUrl: getCanonicalUrl('', locale),
  });
}

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(props: HomePageProps) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: 'LearningPlatform' });
  const preloadedCourses = await getPublicCoursesCached();
  
  // 字体配置：移动端英文使用 Times New Roman，中文统一使用卡通字体
  const getFontFamily = (isEnglish: boolean) => {
    if (isEnglish) {
      // 移动端英文使用 Times New Roman
      return '"Times New Roman", Times, serif';
    } else {
      // 中文统一使用卡通字体
      return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
    }
  };

  return (
    <div
      className="relative min-h-screen"
      data-locale={locale}
      style={{
        backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 主要内容区域 - 桌面端放大10%，移动端正常 */}
      <div className="transform scale-100 lg:scale-110 origin-top">
        {/* 头部区域 - 手写笔记风格 */}
        <section className="relative py-8 md:py-16 lg:py-24 lg:min-h-0 min-h-[calc(100vh-4rem)] flex items-center">
          {/* 头部内容 */}
          <Container className="relative z-10 w-full">
            <div className="text-center space-y-6 w-full max-w-4xl mx-auto px-4 lg:px-0">
              {/* 手写标题 */}
              <div className="space-y-4">
                <h1
                  className="text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-bold text-slate-800 leading-tight homepage-title"
                  style={{
                    fontFamily: getFontFamily(locale === 'en'),
                  }}
                >
                  <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
                    {t('hero.title')} ✨
                  </span>
                </h1>

                {/* 手写副标题 */}
                <p
                  className="text-lg md:text-xl lg:text-xl text-gray-600 max-w-2xl mx-auto homepage-subtitle"
                  style={{
                    fontFamily: getFontFamily(locale === 'en'),
                  }}
                >
                  {t('hero.subtitle')} 📚
                </p>
              </div>

              {/* 输入框区域 */}
              <div className="pt-6">
                <CourseInputSection />
              </div>
            </div>
          </Container>
        </section>

        {/* 课程推荐区域 - 移动端隐藏 */}
        <section className="relative py-8 md:py-12 hidden lg:block">
          <Container>
            <CourseRecommendationWithNavigation courses={preloadedCourses} />
          </Container>
        </section>
      </div>
    </div>
  );
}
