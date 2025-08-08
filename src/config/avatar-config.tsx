'use client';

import { Routes } from '@/routes';
import type { MenuItem } from '@/types';
import { BookOpenIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Get avatar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/avatar
 *
 * @returns The avatar config with translated titles
 */
export function getAvatarLinks(): MenuItem[] {
  return [
    {
      title: 'My Courses',
      href: '/my-courses',
      icon: <BookOpenIcon className="size-4 shrink-0" />,
    },
  ];
}
