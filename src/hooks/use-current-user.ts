import { authClient } from '@/lib/auth-client';
import { useMemo } from 'react';

export const useCurrentUser = () => {
  try {
    const { data: session, error, isPending } = authClient.useSession();

    // 只有在error是非空且有意义的错误时才记录
    if (error && typeof error === 'object' && Object.keys(error).length > 0) {
      console.error('useCurrentUser, error:', error);
    }

    // 使用 useMemo 缓存返回值，避免每次都返回新的引用
    return useMemo(() => {
      // 如果正在加载，返回null
      if (isPending) {
        return null;
      }

      // 如果有错误，返回null
      if (error) {
        return null;
      }

      return session?.user || null;
    }, [session?.user?.id, isPending, error]); // 只依赖 userId，而不是整个 user 对象
  } catch (e) {
    // 捕获任何运行时错误
    console.error('useCurrentUser caught error:', e);
    return null;
  }
};
