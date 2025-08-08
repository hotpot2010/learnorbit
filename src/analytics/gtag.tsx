'use client';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

// Initialize gtag
export const initGA = () => {
  if (!GA_TRACKING_ID) return;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];

  // Define gtag function
  window.gtag = (...args: any[]) => {
    if (window.dataLayer) {
      window.dataLayer.push(args);
    }
  };

  // Initialize with current date
  if (window.gtag) {
    window.gtag('js', new Date());
    // Configure with tracking ID
    window.gtag('config', GA_TRACKING_ID);
  }
};

// Track page views
export const trackPageView = (url: string) => {
  if (!GA_TRACKING_ID || !window.gtag) return;

  window.gtag('config', GA_TRACKING_ID, {
    page_location: url,
  });
};

// Track events
export const trackEvent = (action: string, category?: string, label?: string, value?: number) => {
  if (!GA_TRACKING_ID || !window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Custom Google Analytics component with script injection
export default function CustomGoogleAnalytics() {
  if (!GA_TRACKING_ID) {
    console.warn('Google Analytics ID not found in environment variables');
    return null;
  }

  return (
    <>
      {/* Google tag (gtag.js) */}
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for Google Analytics
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}');
          `,
        }}
      />
    </>
  );
}
