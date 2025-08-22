'use client';

import { XTwitterIcon } from '@/components/icons/x';
import type { MenuItem } from '@/types';
import { websiteConfig } from './website';

/**
 * Get social config
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/social
 *
 * @returns The social config
 */
export function getSocialLinks(): MenuItem[] {
  const socialLinks: MenuItem[] = [];

  // 只保留Twitter社交媒体按钮
  if (websiteConfig.metadata.social?.twitter) {
    socialLinks.push({
      title: 'Twitter',
      href: websiteConfig.metadata.social.twitter,
      icon: <XTwitterIcon className="size-4 shrink-0" />,
    });
  }

  return socialLinks;
}
