'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialLoginButton } from '@/components/auth/social-login-button';
import { authClient } from '@/lib/auth-client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface LoginRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function LoginRequiredDialog({
  open,
  onOpenChange,
  title,
  description,
}: LoginRequiredDialogProps) {
  const router = useRouter();
  const t = useTranslations('Auth');
  const tLogin = useTranslations('AuthPage.login');

  // 获取当前页面URL作为回调地址
  const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '/';

  // 邮箱密码登录状态
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(tLogin('errors.required'));
      return;
    }

    if (!email.includes('@')) {
      setError(tLogin('errors.invalidEmail'));
      return;
    }

    startTransition(async () => {
      try {
        console.log('🔐 Starting email/password login from dialog...');
        const { data, error: authError } = await authClient.signIn.email({
          email: email.trim(),
          password: password,
          callbackURL: currentUrl,
        });

        if (authError) {
          console.error('❌ Login error:', authError);
          setError(authError.message || tLogin('errors.loginFailed'));
          return;
        }

        console.log('✅ Login successful from dialog:', data);
        onOpenChange(false); // 关闭对话框
        window.location.reload(); // 刷新页面以更新登录状态
      } catch (error) {
        console.error('❌ Login exception:', error);
        setError(tLogin('errors.loginFailed'));
      }
    });
  };

  const handleGoToRegister = () => {
    onOpenChange(false);
    router.push('/auth/register');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="transform -rotate-1 max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-lg font-bold text-gray-800 flex items-center gap-2"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            🔐 {title || t('loginRequired')}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-gray-600"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            {description || t('loginRequiredDescription')}
            <br />
            <span className="text-blue-600">
              {t('loginPrompt')} ✨
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* 邮箱密码登录表单 */}
        <div className="py-4 space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-email" className="text-sm font-medium">
                {tLogin('email')}
              </Label>
              <Input
                id="dialog-email"
                type="email"
                placeholder={tLogin('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                className="h-9"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dialog-password" className="text-sm font-medium">
                {tLogin('password')}
              </Label>
              <div className="relative">
                <Input
                  id="dialog-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tLogin('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  className="h-9 pr-10"
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
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-9"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tLogin('signingIn')}
                </>
              ) : (
                tLogin('signIn')
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
                {tLogin('orContinueWith')}
              </span>
            </div>
          </div>

          {/* 社交登录 */}
          <SocialLoginButton callbackUrl={currentUrl} />
        </div>

        <AlertDialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleGoToRegister}
            className="transform rotate-1 text-sm"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            {tLogin('noAccount')}
          </Button>
          <AlertDialogCancel
            className="transform -rotate-1"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            {t('cancel')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for using login check
export function useLoginCheck() {
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const checkLoginAndExecute = (
    user: any,
    callback: () => void,
    customTitle?: string,
    customDescription?: string
  ) => {
    if (!user) {
      setShowLoginDialog(true);
      return false;
    }
    callback();
    return true;
  };

  const LoginDialog = ({
    title,
    description,
  }: { title?: string; description?: string }) => (
    <LoginRequiredDialog
      open={showLoginDialog}
      onOpenChange={setShowLoginDialog}
      title={title}
      description={description}
    />
  );

  return { checkLoginAndExecute, LoginDialog };
}
