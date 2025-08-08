import { websiteConfig } from '@/config/website';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AhrefsAnalytics } from './ahrefs-analytics';
import DataFastAnalytics from './data-fast-analytics';
import GoogleAnalytics from './google-analytics';
import CustomGoogleAnalytics from './gtag';
import OpenPanelAnalytics from './open-panel-analytics';
import { PlausibleAnalytics } from './plausible-analytics';
import { SelineAnalytics } from './seline-analytics';
import { UmamiAnalytics } from './umami-analytics';

/**
 * Analytics Components all in one
 *
 * 1. all the analytics components only work in production
 * 2. only work if the environment variable for the analytics is set
 *
 * docs:
 * https://mksaas.com/docs/analytics
 */
export function Analytics() {
  return (
    <>
      {/* Custom Google Analytics with gtag.js */}
      <CustomGoogleAnalytics />

      {/* Next.js Google Analytics (fallback) */}
      <GoogleAnalytics />

      {/* Other analytics only in production */}
      {process.env.NODE_ENV === 'production' && (
        <>
          {/* umami analytics */}
          <UmamiAnalytics />

          {/* plausible analytics */}
          <PlausibleAnalytics />

          {/* ahrefs analytics */}
          <AhrefsAnalytics />

          {/* datafast analytics */}
          <DataFastAnalytics />

          {/* openpanel analytics */}
          <OpenPanelAnalytics />

          {/* seline analytics */}
          <SelineAnalytics />
        </>
      )}

      {/* vercel analytics */}
      {/* https://vercel.com/docs/analytics/quickstart */}
      {websiteConfig.analytics.enableVercelAnalytics && <VercelAnalytics />}

      {/* speed insights */}
      {/* https://vercel.com/docs/speed-insights/quickstart */}
      {websiteConfig.analytics.enableSpeedInsights && <SpeedInsights />}
    </>
  );
}
