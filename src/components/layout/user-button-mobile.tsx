'use client';

import { UserAvatar } from '@/components/layout/user-avatar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { getAvatarLinks } from '@/config/avatar-config';
import { LocaleLink, useLocaleRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { usePaymentStore } from '@/stores/payment-store';
import type { User } from 'better-auth';
import { LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface UserButtonProps {
  user: User;
}

export function UserButtonMobile({ user }: UserButtonProps) {
  const t = useTranslations();
  const avatarLinks = getAvatarLinks();
  const localeRouter = useLocaleRouter();
  const [open, setOpen] = useState(false);
  const { resetState } = usePaymentStore();

  const closeDrawer = () => {
    setOpen(false);
  };

  const handleSignOut = async () => {
    try {
      console.log('🚪 [Mobile] Starting sign out process...');
      
      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: (ctx) => {
            console.log('✅ [Mobile] Sign out success:', ctx);
            // Reset payment state on sign out
            resetState();
            // 关闭drawer
            closeDrawer();
            // 使用 replace 而不是 push 避免返回按钮问题
            localeRouter.replace('/');
            toast.success(t('Common.logoutSuccess') || 'Logout successful');
          },
          onError: (ctx) => {
            console.error('❌ [Mobile] Sign out error:', ctx.error);
            toast.error(t('Common.logoutFailed') || 'Logout failed');
          },
        },
      });
      
      console.log('🚪 [Mobile] Sign out result:', result);
    } catch (error) {
      console.error('❌ [Mobile] Sign out caught error:', error);
      toast.error(t('Common.logoutFailed') || 'Logout failed');
    }
  };

  return (
    <Drawer open={open} onClose={closeDrawer}>
      <DrawerTrigger onClick={() => setOpen(true)}>
        <UserAvatar
          name={user.name}
          image={user.image}
          className="size-8 border cursor-pointer"
        />
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-40 bg-background/50" />
        <DrawerContent
          className="fixed inset-x-0 bottom-0 z-50 mt-24 
            overflow-hidden rounded-t-[10px] border bg-background px-3 text-sm"
        >
          <DrawerHeader>
            <DrawerTitle />
          </DrawerHeader>
          <div className="flex items-center justify-start gap-4 p-2">
            <UserAvatar
              name={user.name}
              image={user.image}
              className="size-8 border cursor-pointer"
            />
            <div className="flex flex-col">
              <p className="font-medium">{user.name}</p>
              <p className="w-[200px] truncate text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <ul className="mb-14 mt-1 w-full text-muted-foreground">
            {avatarLinks?.map((item) => (
              <li
                key={item.title}
                className="rounded-lg text-foreground hover:bg-muted"
              >
                <LocaleLink
                  href={item.href || '#'}
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  {item.icon ? item.icon : null}
                  <p className="text-sm">{item.title}</p>
                </LocaleLink>
              </li>
            ))}

            <li
              key="logout"
              className="rounded-lg text-foreground hover:bg-muted"
            >
              <a
                href="#"
                onClick={async (event) => {
                  event.preventDefault();
                  closeDrawer();
                  handleSignOut();
                }}
                className="flex w-full items-center gap-3 px-2.5 py-2"
              >
                <LogOutIcon className="size-4" />
                <p className="text-sm">{t('Common.logout')}</p>
              </a>
            </li>
          </ul>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}