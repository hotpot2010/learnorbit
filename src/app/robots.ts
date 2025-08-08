import type { MetadataRoute } from 'next';
import { getBaseUrl } from '../lib/urls/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/*',
          '/_next/*',
          '/admin/*',
          '/dashboard/*',
          '/auth/*',
          '/study/*',
          '/my-courses',
          '/.well-known/*',
          '/tmp/*',
          '*.json',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/*',
          '/_next/*',
          '/admin/*',
          '/dashboard/*',
          '/auth/*',
          '/study/*',
          '/my-courses',
          '/.well-known/*',
          '/tmp/*',
        ],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
    host: getBaseUrl(),
  };
}
