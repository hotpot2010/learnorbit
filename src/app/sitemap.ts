import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';
import { getDb } from '@/db';
import { creatorCourses, userCourses, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateCourseSlug } from '@/lib/creator-utils';

type Href = Parameters<typeof getLocalePathname>[0]['href'];

/**
 * static routes for sitemap, you may change the routes for your own
 */
const staticRoutes = [
  '/',
  '/contact',
  '/login',
  '/register',
  '/my-courses',
  '/custom',
  '/course-marketplace',
  '/pricing',
];

/**
 * Generate a sitemap for the website
 *
 * https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
 * https://github.com/javayhu/cnblocks/blob/main/app/sitemap.ts
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapList: MetadataRoute.Sitemap = []; // final result

  // Check if this is production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? 'https://aitutorly.ai' : getBaseUrl();

  // only add static routes for production environment
  if (isProduction) {
    sitemapList.push(
      ...staticRoutes.flatMap((route) => {
        return routing.locales.map((locale) => ({
          url: getProductionUrl(route, locale),
          lastModified: new Date(),
          priority: 1,
          changeFrequency: 'weekly' as const,
        }));
      })
    );
  }

  // add all public courses to sitemap (only for production environment)
  if (isProduction) {
    try {
      const db = await getDb();

      // 1. Add creator courses with clean URLs
      const activeCreatorCourses = await db
        .select({
          slug: creatorCourses.slug,
          title: creatorCourses.title,
          updatedAt: creatorCourses.updatedAt,
        })
        .from(creatorCourses)
        .where(eq(creatorCourses.isActive, true));

      // add creator course routes for each locale
      activeCreatorCourses.forEach((course) => {
        routing.locales.forEach((locale) => {
          sitemapList.push({
            url: getProductionUrl(`/study/${course.slug}` as Href, locale),
            lastModified: new Date(course.updatedAt),
            priority: 0.9, // 创作者课程优先级更高
            changeFrequency: 'monthly' as const,
          });
        });
      });

      // 2. Add all other public courses
      const publicCourses = await db
        .select({
          id: userCourses.id,
          userId: userCourses.userId,
          coursePlan: userCourses.coursePlan,
          updatedAt: userCourses.updatedAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(userCourses)
        .innerJoin(user, eq(userCourses.userId, user.id));

      // 过滤出公共课程
      const filteredPublicCourses = publicCourses.filter((course: any) =>
        course.coursePlan && (course.coursePlan as any).isPublic === true
      );

      // 为每个公共课程生成sitemap条目
      filteredPublicCourses.forEach((course: any) => {
        const rawPlan = course.coursePlan?.plan;
        let coursePlan: any;
        let planSteps: any[];

        // 兼容新旧格式
        if (rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan) && (rawPlan.title || rawPlan.description || rawPlan.introduction || rawPlan.plan)) {
          coursePlan = rawPlan;
          planSteps = rawPlan.plan || [];
        } else {
          coursePlan = {};
          planSteps = Array.isArray(rawPlan) ? rawPlan : [];
        }

        const title = coursePlan.title || planSteps[0]?.title || 'Untitled Course';
        const isCreatorAccount = course.userEmail && ['zhouletao20@gmail.com', 'ritafeng1234@gmail.com'].includes(course.userEmail.toLowerCase());

        // 生成课程slug
        const courseSlug = generateCourseSlug(title, course.userId, isCreatorAccount);

        // 只添加非创作者课程到sitemap（创作者课程已经通过上面的逻辑添加了）
        if (!isCreatorAccount) {
          routing.locales.forEach((locale) => {
            sitemapList.push({
              url: getProductionUrl(`/study/${courseSlug}` as Href, locale),
              lastModified: new Date(course.updatedAt),
              priority: 0.7,
              changeFrequency: 'monthly' as const,
            });
          });
        }
      });

      console.log(`✅ Added ${activeCreatorCourses.length} creator courses and ${filteredPublicCourses.length} regular public courses to sitemap`);
    } catch (error) {
      console.error('❌ Failed to add courses to sitemap:', error);
    }
  } else {
    console.log(`🚫 Skipping all sitemap entries - not production environment (NODE_ENV: ${process.env.NODE_ENV})`);
  }

  return sitemapList;
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return getBaseUrl() + pathname;
}

function getProductionUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return 'https://aitutorly.ai' + pathname;
}

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#sitemap
 * https://github.com/amannn/next-intl/blob/main/examples/example-app-router/src/app/sitemap.ts
 */
function getEntries(href: Href) {
  return routing.locales.map((locale) => ({
    url: getUrl(href, locale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((cur) => [cur, getUrl(href, cur)])
      ),
    },
  }));
}
