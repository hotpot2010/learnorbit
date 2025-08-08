import { websiteConfig } from '@/config/website';
import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { blogSource, categorySource, source } from '@/lib/source';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl } from '../lib/urls/urls';

type Href = Parameters<typeof getLocalePathname>[0]['href'];

/**
 * static routes for sitemap, you may change the routes for your own
 */
const staticRoutes = [
  '/',
  '/blog',
  '/docs',
  '/contact',
  '/changelog',
  '/privacy-policy',
  '/cookie-policy',
  '/login',
  '/register',
  '/my-courses',
  '/custom',
];

/**
 * Generate a sitemap for the website
 *
 * https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
 * https://github.com/javayhu/cnblocks/blob/main/app/sitemap.ts
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapList: MetadataRoute.Sitemap = []; // final result

  // add static routes
  sitemapList.push(
    ...staticRoutes.flatMap((route) => {
      return routing.locales.map((locale) => ({
        url: getUrl(route, locale),
        lastModified: new Date(),
        priority: 1,
        changeFrequency: 'weekly' as const,
      }));
    })
  );

  // add categories
  sitemapList.push(
    ...categorySource.getPages().flatMap((category) =>
      routing.locales.map((locale) => ({
        url: getUrl(`/blog/category/${category.slugs[0]}`, locale),
        lastModified: new Date(),
        priority: 0.8,
        changeFrequency: 'weekly' as const,
      }))
    )
  );

  // TODO: 重新启用当blog和category数据源配置完成后
  // add paginated blog list pages
  // routing.locales.forEach((locale) => {
  //   try {
  //     const posts = blogSource
  //       .getPages(locale)
  //       .filter((post) => post.data?.published === true);
  //     const totalPages = Math.max(
  //       1,
  //       Math.ceil(posts.length / websiteConfig.blog.paginationSize)
  //     );
  //     // /blog/page/[page] (from 2)
  //     for (let page = 2; page <= totalPages; page++) {
  //       sitemapList.push({
  //         url: getUrl(`/blog/page/${page}`, locale),
  //         lastModified: new Date(),
  //       });
  //     }
  //   } catch (error) {
  //     console.warn('Blog source not available, skipping blog sitemap entries');
  //   }
  // });

  // TODO: 重新启用当category数据源配置完成后
  // add paginated category pages
  // routing.locales.forEach((locale) => {
  //   try {
  //     const localeCategories = categorySource.getPages(locale);
  //     localeCategories.forEach((category) => {
  //       // posts in this category and locale
  //       const postsInCategory = blogSource
  //         .getPages(locale)
  //         .filter((post) => post.data?.published === true)
  //         .filter((post) =>
  //           post.data?.categories?.some((cat: any) => cat === category.slugs[0])
  //         );
  //       const totalPages = Math.max(
  //         1,
  //         Math.ceil(postsInCategory.length / websiteConfig.blog.paginationSize)
  //       );
  //       // /blog/category/[slug] (first page)
  //       sitemapList.push({
  //         url: getUrl(`/blog/category/${category.slugs[0]}`, locale),
  //         lastModified: new Date(),
  //       });
  //       // /blog/category/[slug]/page/[page] (from 2)
  //       for (let page = 2; page <= totalPages; page++) {
  //         sitemapList.push({
  //           url: getUrl(`/blog/category/${category.slugs[0]}/page/${page}`, locale),
  //           lastModified: new Date(),
  //         });
  //       }
  //     });
  //   } catch (error) {
  //     console.warn('Category source not available, skipping category sitemap entries');
  //   }
  // });

  // add posts (single post pages)
  sitemapList.push(
    ...blogSource.getPages().flatMap((post) =>
      routing.locales
        .filter((locale) => post.locale === locale)
        .map((locale) => ({
          url: getUrl(`/blog/${post.slugs.join('/')}`, locale),
          lastModified: new Date(),
          priority: 0.8,
          changeFrequency: 'weekly' as const,
        }))
    )
  );

  // add docs
  const docsParams = source.generateParams();
  sitemapList.push(
    ...docsParams.flatMap((param) =>
      routing.locales.map((locale) => ({
        url: getUrl(`/docs/${param.slug.join('/')}`, locale),
        lastModified: new Date(),
        priority: 0.8,
        changeFrequency: 'weekly' as const,
      }))
    )
  );

  return sitemapList;
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return getBaseUrl() + pathname;
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
