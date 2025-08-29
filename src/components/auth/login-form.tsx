'use client';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCallbackUrl = searchParams?.get('callbackUrl');
  const callbackUrl = propCallbackUrl || paramCallbackUrl || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('errors.required'));
      return;
    }

    if (!email.includes('@')) {
      setError(t('errors.invalidEmail'));
      return;
    }

    startTransition(async () => {
      try {
        console.log('🔐 Starting email/password login...');
        const { data, error: authError } = await authClient.signIn.email({
          email: email.trim(),
          password: password,
          callbackURL: callbackUrl,
        });

        if (authError) {
          console.error('❌ Login error:', authError);
          setError(authError.message || t('errors.loginFailed'));
          return;
        }

        console.log('✅ Login successful:', data);
        router.push(callbackUrl);
      } catch (error) {
        console.error('❌ Login exception:', error);
        setError(t('errors.loginFailed'));
      }
    });
  };

  return (
    <AuthCard
      headerLabel={t('welcomeBack')}
      bottomButtonLabel={t('noAccount')}
      bottomButtonHref="/auth/register"
      className={cn('', className)}
    >
      <div className="space-y-6">
        {/* 邮箱密码登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('signingIn')}
              </>
            ) : (
              t('signIn')
            )}
          </Button>
        </form>

        {/* 分隔线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t('orContinueWith')}
            </span>
          </div>
        </div>

        {/* 社交登录 */}
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
    </AuthCard>
  );
};
