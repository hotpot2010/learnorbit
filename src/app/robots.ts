import type { MetadataRoute } from 'next';
import { getBaseUrl } from '../lib/urls/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/study/*'],
        disallow: [
          '/api/*',
          '/_next/*',
          '/admin/*',
          '/dashboard/*',
          '/auth/*',
          '/my-courses/*',
          '/.well-known/*',
          '/tmp/*',
          '*.json',
          '/private/*',
          '/test/*',
          '/blog/*',
          '/docs/*',
          '/changelog/*',
          '/privacy-policy',
          '/cookie-policy',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/study/*'],
        disallow: [
          '/api/*',
          '/_next/*',
          '/admin/*',
          '/dashboard/*',
          '/auth/*',
          '/my-courses/*',
          '/.well-known/*',
          '/tmp/*',
          '/private/*',
          '/test/*',
          '/blog/*',
          '/docs/*',
          '/changelog/*',
          '/privacy-policy',
          '/cookie-policy',
        ],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
    host: getBaseUrl(),
  };
}
