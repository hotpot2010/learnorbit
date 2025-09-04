'use client';

import { useCurrentUser } from '@/hooks/use-current-user';
import { initKeyActionsAnalytics, updateUserId } from '@/lib/key-actions-analytics';
import { useEffect, useRef } from 'react';

interface KeyActionsProviderProps {
  children: React.ReactNode;
}

/**
 * 关键行为分析Provider
 * 负责在用户登录后初始化关键行为追踪系统
 */
export function KeyActionsProvider({ children }: KeyActionsProviderProps) {
  const currentUser = useCurrentUser();
  const initializedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // 处理用户登录状态变化
    if (currentUser?.id) {
      // 如果是新用户或用户ID发生变化，重新初始化
      if (initializedRef.current !== currentUser.id) {
        try {
          if (initializedRef.current) {
            // 用户切换，更新用户ID
            updateUserId(currentUser.id);
            console.log('🎯 用户切换，关键行为追踪用户ID已更新:', currentUser.id);
          } else {
            // 首次登录，初始化追踪系统
            initKeyActionsAnalytics(currentUser.id);
            console.log('🎯 关键行为追踪已初始化:', currentUser.id);
          }
          initializedRef.current = currentUser.id;
        } catch (error) {
          console.error('❌ 关键行为追踪初始化失败:', error);
        }
      }
    } else {
      // 用户登出，清除初始化标记
      if (initializedRef.current) {
        console.log('🔒 用户已登出，关键行为追踪已暂停');
        initializedRef.current = null;
      }
    }
  }, [currentUser?.id]);
  
  return <>{children}</>;
}
