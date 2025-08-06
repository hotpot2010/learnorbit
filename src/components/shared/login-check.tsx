'use client';

import { useCurrentUser } from '@/hooks/use-current-user';
import { useRouter } from 'next/navigation';

export function useAuthCheck() {
  const currentUser = useCurrentUser();
  const router = useRouter();

  const requireAuth = (callback: () => void) => {
    // 使用更安全的用户检查
    if (!currentUser) {
      // 简单的alert提示，然后跳转登录
      alert('请先登录才能使用此功能！');
      router.push('/login');
      return false;
    }
    callback();
    return true;
  };

  // 使用更安全的登录状态检查
  const isLoggedIn = Boolean(currentUser);

  return { requireAuth, isLoggedIn };
}
