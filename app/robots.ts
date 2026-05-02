import type { MetadataRoute } from 'next';

/**
 * Generates /robots.txt at the root.
 *
 * SECURITY: Explicitly disallows crawling of admin panels, API endpoints,
 * and user-specific routes to prevent data leakage and unnecessary indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/profile/',
          '/reports',
          '/notifications',
          '/missions',
        ],
      },
    ],
    sitemap: 'https://civiclens.tech/sitemap.xml',
  };
}
