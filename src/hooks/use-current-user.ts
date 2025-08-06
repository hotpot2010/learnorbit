import { authClient } from '@/lib/auth-client';

export const useCurrentUser = () => {
  try {
    const { data: session, error } = authClient.useSession();

    // 只有在error是非空且有意义的错误时才记录
    if (error && typeof error === 'object' && Object.keys(error).length > 0) {
      console.error('useCurrentUser, error:', error);
    }

    // 如果有错误，返回null
    if (error) {
      return null;
    }

    return session?.user || null;
  } catch (e) {
    // 捕获任何运行时错误
    console.error('useCurrentUser caught error:', e);
    return null;
  }
};
