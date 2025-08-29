'use client';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SocialLoginButton } from './social-login-button';

export interface RegisterFormProps {
  className?: string;
  callbackUrl?: string;
}

export const RegisterForm = ({
  className,
  callbackUrl: propCallbackUrl,
}: RegisterFormProps) => {
  const t = useTranslations('AuthPage.register');
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCallbackUrl = searchParams?.get('callbackUrl');
  const callbackUrl = propCallbackUrl || paramCallbackUrl || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 表单验证
    if (!name || !email || !password || !confirmPassword) {
      setError(t('errors.required'));
      return;
    }

    if (!email.includes('@')) {
      setError(t('errors.invalidEmail'));
      return;
    }

    if (password.length < 6) {
      setError(t('errors.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    startTransition(async () => {
      try {
        console.log('🔐 Starting email/password registration...');
        const { data, error: authError } = await authClient.signUp.email({
          email: email.trim(),
          password: password,
          name: name.trim(),
          callbackURL: callbackUrl,
        });

        if (authError) {
          console.error('❌ Registration error:', authError);
          setError(authError.message || t('errors.registrationFailed'));
          return;
        }

        console.log('✅ Registration successful:', data);
        router.push(callbackUrl);
      } catch (error) {
        console.error('❌ Registration exception:', error);
        setError(t('errors.registrationFailed'));
      }
    });
  };

  return (
    <AuthCard
      headerLabel={t('createAccount')}
      bottomButtonLabel={t('alreadyHaveAccount')}
      bottomButtonHref="/auth/login"
      className={cn('', className)}
    >
      <div className="space-y-6">
        {/* 邮箱密码注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

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
                minLength={6}
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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t('confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isPending}
              >
                {showConfirmPassword ? (
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
                {t('creatingAccount')}
              </>
            ) : (
              t('createAccount')
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