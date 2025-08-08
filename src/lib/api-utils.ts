import { auth } from '@/lib/auth';
import { LOCALE_COOKIE_NAME } from '@/i18n/routing';
import type { NextRequest } from 'next/server';

/**
 * 获取API请求的用户信息和语言设置
 */
export async function getApiRequestContext(request: NextRequest) {
  // 获取当前用户session
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // 获取语言信息（优先使用locale cookie）
  const cookies = request.headers.get('cookie') || '';
  const localeCookieRegex = new RegExp(`${LOCALE_COOKIE_NAME}=([^;]*)`);
  const localeCookie = cookies.match(localeCookieRegex)?.[1];
  
  let lang = 'en'; // 默认英文
  
  if (localeCookie) {
    // 如果有locale cookie，直接使用
    lang = localeCookie;
  } else {
    // 如果没有locale cookie，检查accept-language
    const acceptLanguage = request.headers.get('accept-language') || '';
    // 更精确的中文检测
    if (acceptLanguage.includes('zh-CN') || acceptLanguage.includes('zh-Hans') || 
        acceptLanguage.includes('zh') && !acceptLanguage.includes('zh-TW')) {
      lang = 'zh';
    }
  }

  console.log('🌐 语言检测:', {
    cookieName: LOCALE_COOKIE_NAME,
    cookieString: cookies,
    localeCookie,
    acceptLanguage: request.headers.get('accept-language'),
    finalLang: lang
  });

  return {
    userId: session?.user?.id || null,
    lang: lang,
    session: session,
  };
}

/**
 * 增强API请求数据，添加用户ID和语言信息
 */
export function enhanceApiRequest<T extends Record<string, any>>(
  originalData: T,
  context: { userId: string | null; lang: string }
): T & { id?: string | null; lang?: string } {
  return {
    ...originalData,
    id: context.userId,
    lang: context.lang,
  };
} 