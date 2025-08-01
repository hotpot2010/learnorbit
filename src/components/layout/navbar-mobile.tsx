'use client';

import LocaleSelector from '@/components/layout/locale-selector';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcherHorizontal } from '@/components/layout/mode-switcher-horizontal';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { Portal } from '@radix-ui/react-portal';
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MenuIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { Skeleton } from '../ui/skeleton';
import { UserButtonMobile } from './user-button-mobile';

export function NavbarMobile({
  className,
  ...other
}: React.HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations();
  const [open, setOpen] = React.useState<boolean>(false);
  const localePathname = useLocalePathname();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = () => {
      if (document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
      }

      setOpen(false);
    };

    handleRouteChangeStart();
  }, [localePathname]);

  const handleChange = () => {
    const mediaQueryList = window.matchMedia('(min-width: 1024px)');
    setOpen((open) => (open ? !mediaQueryList.matches : false));
  };

  useEffect(() => {
    handleChange();
    const mediaQueryList = window.matchMedia('(min-width: 1024px)');
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  const handleToggleMobileMenu = (): void => {
    setOpen((open) => !open);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div
        className={cn('flex items-center justify-between', className)}
        {...other}
      >
        {/* navbar left shows logo */}
        <LocaleLink href={Routes.Root} className="flex items-center gap-2">
          <Logo />
          <span className="text-xl font-semibold">{t('Metadata.name')}</span>
        </LocaleLink>

        {/* navbar right shows menu icon and user button */}
        <div className="flex items-center justify-end gap-4">
          {/* show user button if user is logged in */}
          {isPending ? (
            <Skeleton className="size-8 border rounded-full" />
          ) : currentUser ? (
            <UserButtonMobile user={currentUser} />
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label="Toggle Mobile Menu"
            onClick={handleToggleMobileMenu}
            className="size-8 flex aspect-square h-fit select-none items-center
              justify-center rounded-md border cursor-pointer"
          >
            {open ? (
              <XIcon className="size-4" />
            ) : (
              <MenuIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <Portal asChild>
          {/* if we don't add RemoveScroll component, the underlying
            page will scroll when we scroll the mobile menu */}
          <RemoveScroll allowPinchZoom enabled>
            {/* Only render MainMobileMenu when not in loading state */}
            {!isPending && (
              <MainMobileMenu
                userLoggedIn={!!currentUser}
                onLinkClicked={handleToggleMobileMenu}
              />
            )}
          </RemoveScroll>
        </Portal>
      )}
    </>
  );
}

interface MainMobileMenuProps {
  userLoggedIn: boolean;
  onLinkClicked: () => void;
}

function MainMobileMenu({ userLoggedIn, onLinkClicked }: MainMobileMenuProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const t = useTranslations();
  const menuLinks = [
    { title: 'Home', href: '/' },
    { title: 'My Courses', href: '/my-courses' },
    { title: 'Pricing', href: '/pricing' },
    { title: 'Contact', href: '/contact' },
  ];
  const localePathname = useLocalePathname();

  return (
    <div
      className="fixed w-full inset-0 z-50 mt-[64px] overflow-y-auto
      bg-background backdrop-blur-md animate-in fade-in-0"
    >
      <div className="size-full flex flex-col items-start space-y-4">
        {/* action buttons */}
        {userLoggedIn ? null : (
          <div className="w-full flex flex-col gap-4 px-4">
            <LocaleLink
              href={Routes.Login}
              onClick={onLinkClicked}
              className={cn(
                buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                }),
                'w-full'
              )}
            >
              {t('Common.login')}
            </LocaleLink>
            <LocaleLink
              href={Routes.Register}
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'lg',
                }),
                'w-full'
              )}
              onClick={onLinkClicked}
            >
              {t('Common.signUp')}
            </LocaleLink>
          </div>
        )}

        {/* main menu */}
        <ul className="w-full px-4">
          {menuLinks?.map((item) => {
            const isActive = item.href
              ? localePathname.startsWith(item.href)
              : false;

            return (
              <li key={item.title} className="py-1">
                <LocaleLink
                  href={item.href || '#'}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'w-full !pl-2 justify-start cursor-pointer group',
                    'bg-transparent text-muted-foreground',
                    'hover:bg-transparent hover:text-foreground',
                    'focus:bg-transparent focus:text-foreground',
                    isActive && 'font-semibold bg-transparent text-foreground'
                  )}
                  onClick={onLinkClicked}
                >
                  <div className="flex items-center w-full pl-0">
                    <span className="text-base">{item.title}</span>
                  </div>
                </LocaleLink>
              </li>
            );
          })}
        </ul>

        {/* bottom buttons */}
        <div className="flex w-full items-center justify-between gap-4 border-t border-border/50 p-4">
          <LocaleSelector />
          <ModeSwitcherHorizontal />
        </div>
      </div>
    </div>
  );
}
