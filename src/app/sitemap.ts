import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';
// Database imports removed - sitemap database queries disabled
// import { getDb } from '@/db';
// import { creatorCourses, userCourses, user } from '@/db/schema';
// import { eq } from 'drizzle-orm';
// import { generateCourseSlug } from '@/lib/creator-utils';

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

  // Database queries disabled - sitemap database queries temporarily disabled
  // Only static routes are included in sitemap
  if (isProduction) {
    console.log('⚠️ Sitemap database queries disabled - only static routes included');
    // try {
    //   const db = await getDb();
    //   // ... database queries removed
    // } catch (error) {
    //   console.error('❌ Failed to add courses to sitemap:', error);
    // }
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
