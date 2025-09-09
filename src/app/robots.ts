import type { MetadataRoute } from 'next';
import { getBaseUrl } from '../lib/urls/urls';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://aitutorly.ai' : getBaseUrl();
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/study/*', '/course-marketplace', '/pricing', '/contact'],
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
        allow: ['/', '/study/*', '/course-marketplace', '/pricing', '/contact'],
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
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
