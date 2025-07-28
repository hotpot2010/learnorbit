'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import Container from '@/components/layout/container';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcher } from '@/components/layout/mode-switcher';
import { NavbarMobile } from '@/components/layout/navbar-mobile';
import { UserButton } from '@/components/layout/user-button';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { useScroll } from '@/hooks/use-scroll';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';
import LocaleSwitcher from './locale-switcher';

interface NavBarProps {
  scroll?: boolean;
}

export function Navbar({ scroll }: NavBarProps) {
  const t = useTranslations();
  const scrolled = useScroll(50);
  const localePathname = useLocalePathname();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 简化的菜单项
  const menuItems = [
    { title: 'Home', href: '/' },
    { title: 'My Courses', href: '/my-courses' },
    { title: 'Pricing', href: '/pricing' },
    { title: 'Contact', href: '/contact' },
  ];

  return (
    <section
      className={cn(
        'sticky inset-x-0 top-0 z-40 py-2 transition-all duration-300',
        scroll
          ? scrolled
            ? 'bg-background/80 backdrop-blur-md border-b supports-backdrop-filter:bg-background/60'
            : 'bg-transparent'
          : 'border-b bg-background'
      )}
    >
      <Container className="px-4">
        {/* desktop navbar */}
        <nav className="hidden lg:flex">
          {/* logo and name */}
          <div className="flex items-center">
            <LocaleLink href="/" className="flex items-center space-x-2">
              <Logo />
              <span className="text-xl font-semibold">
                {t('Metadata.name')}
              </span>
            </LocaleLink>
          </div>

          {/* menu links */}
          <div className="flex-1 flex items-center justify-center space-x-8">
            {menuItems.map((item, index) => (
              <LocaleLink
                key={index}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  localePathname === item.href || 
                  (item.href !== '/' && localePathname.startsWith(item.href))
                    ? 'text-foreground' 
                    : 'text-muted-foreground'
                )}
              >
                {item.title}
              </LocaleLink>
            ))}
          </div>

          {/* navbar right show sign in or user */}
          <div className="flex items-center gap-x-4">
            {!mounted || isPending ? (
              <Skeleton className="size-8 border rounded-full" />
            ) : currentUser ? (
              <UserButton user={currentUser} />
            ) : (
              <div className="flex items-center gap-x-4">
                <LoginWrapper mode="modal" asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    {t('Common.login')}
                  </Button>
                </LoginWrapper>

                <LocaleLink
                  href={Routes.Register}
                  className={cn(
                    buttonVariants({
                      variant: 'default',
                      size: 'sm',
                    })
                  )}
                >
                  {t('Common.signUp')}
                </LocaleLink>
              </div>
            )}

            <ModeSwitcher />
            <LocaleSwitcher />
          </div>
        </nav>

        {/* mobile navbar */}
        <NavbarMobile className="lg:hidden" />
      </Container>
    </section>
  );
}
