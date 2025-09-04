import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';
import { getDb } from '@/db';
import { creatorCourses } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

  // add creator courses with clean URLs (only for production environment)
  if (isProduction) {
    try {
      const db = await getDb();
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
            priority: 0.8,
            changeFrequency: 'monthly' as const,
          });
        });
      });

      console.log(`✅ Added ${activeCreatorCourses.length} creator courses to sitemap for production domain`);
    } catch (error) {
      console.error('❌ Failed to add creator courses to sitemap:', error);
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
