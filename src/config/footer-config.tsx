'use client';

import { Routes } from '@/routes';
import type { NestedMenuItem } from '@/types';
import { useTranslations } from 'next-intl';

/**
 * Get footer config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/footer
 *
 * @returns The footer config with translated titles
 */
export function getFooterLinks(): NestedMenuItem[] {
  const t = useTranslations('Marketing.footer');
  return [
    // 只保留Company中的contact
    {
      title: t('company.title'),
      items: [
        {
          title: t('company.items.contact'),
          href: Routes.Contact,
          external: false,
        },
      ],
    },
    // 新增Quick Links区域
    {
      title: t('quicklinks.title'),
      items: [
        {
          title: t('quicklinks.items.mossai'),
          href: 'https://mossai.org',
          external: true,
        },
      ],
    },
  ];
}
