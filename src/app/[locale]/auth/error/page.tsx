'use client';

import { ErrorCard } from '@/components/auth/error-card';
import { useSearchParams } from 'next/navigation';
import type { Metadata } from 'next';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  // 显示具体错误信息（如果有）
  if (error) {
    console.error('🔴 Auth error:', error);
  }
  
  return <ErrorCard />;
}

