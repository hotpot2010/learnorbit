'use client';

import { AuthCard } from '@/components/auth/auth-card';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { SocialLoginButton } from './social-login-button';

interface RegisterFormProps {
  callbackUrl?: string;
}

export const RegisterForm = ({
  callbackUrl: propCallbackUrl,
}: RegisterFormProps) => {
  const t = useTranslations('AuthPage.register');
  const searchParams = useSearchParams();
  const paramCallbackUrl = searchParams?.get('callbackUrl');
  const callbackUrl = propCallbackUrl || paramCallbackUrl || '/my-courses';

  // 只显示Google登录，不显示邮箱密码注册表单
  return (
    <AuthCard
      headerLabel={t('createAccount') || '创建账号'}
      bottomButtonLabel="" // 隐藏底部登录链接
      bottomButtonHref=""
    >
          <div className="space-y-4">
        <div className="text-center text-sm text-muted-foreground">
          使用Google账号注册
          </div>
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
    </AuthCard>
  );
};
