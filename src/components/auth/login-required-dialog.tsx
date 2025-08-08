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
  title = '需要登录',
  description = '请先登录以使用此功能',
}: LoginRequiredDialogProps) {
  const router = useRouter();
  // const t = useTranslations('Auth');

  const handleLogin = () => {
    onOpenChange(false);
    router.push('/login');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="transform -rotate-1">
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-lg font-bold text-gray-800 flex items-center gap-2"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            🔐 {title}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-gray-600"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            {description}
            <br />
            <span className="text-blue-600">
              登录后即可开始您的学习之旅！✨
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            className="transform rotate-1"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLogin}
            className="bg-blue-500 hover:bg-blue-600 transform -rotate-1"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            前往登录 🚀
          </AlertDialogAction>
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
