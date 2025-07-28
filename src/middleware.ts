import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { LOCALES, routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  console.log('🔍 Middleware - pathname:', nextUrl.pathname);

  // Check if the current path has no locale prefix
  const hasLocalePrefix = LOCALES.some(locale => 
    nextUrl.pathname.startsWith(`/${locale}/`) || nextUrl.pathname === `/${locale}`
  );
  
  console.log('🌐 Has locale prefix:', hasLocalePrefix);
  console.log('🗺️ Available locales:', LOCALES);
  
  // If no locale prefix and not root path, redirect to English version
  if (!hasLocalePrefix && nextUrl.pathname !== '/') {
    const englishPath = `/en${nextUrl.pathname}${nextUrl.search}`;
    console.log('➡️ Redirecting to English:', englishPath);
    return NextResponse.redirect(new URL(englishPath, nextUrl));
  }

  // Apply intlMiddleware for all routes (temporarily disabled for testing)
  console.log('🌍 Applying intlMiddleware');
  return NextResponse.next(); // intlMiddleware(req);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - if they start with `/api`, `/_next` or `/_vercel`
    // - if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
