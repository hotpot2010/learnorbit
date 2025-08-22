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
import { SocialLoginButton } from '@/components/auth/social-login-button';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

  // 获取当前页面URL作为回调地址
  const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="transform -rotate-1 max-w-md">
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
        
        {/* 登录按钮区域 */}
        <div className="py-4">
          <div className="text-center text-sm text-muted-foreground mb-4"
               style={{
                 fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
               }}>
            {t('useGoogleLogin')}
          </div>
          <SocialLoginButton callbackUrl={currentUrl} />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            className="transform rotate-1"
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
