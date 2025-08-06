'use client';

import { AuthCard } from '@/components/auth/auth-card';
import { websiteConfig } from '@/config/website';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { SocialLoginButton } from './social-login-button';

export interface LoginFormProps {
  className?: string;
  callbackUrl?: string;
}

export const LoginForm = ({
  className,
  callbackUrl: propCallbackUrl,
}: LoginFormProps) => {
  const t = useTranslations('AuthPage.login');
  const searchParams = useSearchParams();
  const paramCallbackUrl = searchParams?.get('callbackUrl');
  const callbackUrl = propCallbackUrl || paramCallbackUrl || '/my-courses';

  // 只显示Google登录，不显示邮箱密码登录表单
  return (
    <AuthCard
      headerLabel={t('welcomeBack')}
      bottomButtonLabel="" // 隐藏底部注册链接，因为不支持邮箱注册
      bottomButtonHref=""
      className={cn('', className)}
    >
          <div className="space-y-4">
        <div className="text-center text-sm text-muted-foreground">
          使用Google账号登录
          </div>
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
    </AuthCard>
  );
};
