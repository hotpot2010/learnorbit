import { Analytics } from '@/analytics/analytics';
import {
  fontBricolageGrotesque,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import AffonsoScript from '@/components/affiliate/affonso';
import PromotekitScript from '@/components/affiliate/promotekit';
import { DefaultOrganizationData, DefaultWebsiteData } from '@/components/seo/structured-data';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { defaultSEO } from '@/lib/seo';

import '@/styles/globals.css';

interface Props {
  children: ReactNode;
}

export const metadata = defaultSEO;

/**
 * Since we have a `not-found.tsx` page on the root, a layout file
 * is required, even if it's just passing children through.
 *
 * https://next-intl.dev/docs/environments/error-files#catching-non-localized-requests
 */
export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <AffonsoScript />
        <PromotekitScript />
        <DefaultOrganizationData />
        <DefaultWebsiteData />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          'size-full antialiased',
          fontNotoSans.className,
          fontNotoSerif.variable,
          fontNotoSansMono.variable,
          fontBricolageGrotesque.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}
