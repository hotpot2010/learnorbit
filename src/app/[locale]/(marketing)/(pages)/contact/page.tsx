import Container from '@/components/layout/container';
import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'ContactPage' });

  return constructMetadata({
    title: pt('title') + ' | ' + t('title'),
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/contact', locale),
  });
}

/**
 * Simplified contact page with only email address
 */
export default async function ContactPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
        backgroundSize: '20px 20px',
      }}
    >
      <Container className="py-16 px-4">
        <div className="mx-auto max-w-4xl space-y-8 pb-16">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1
              className="text-3xl md:text-4xl font-bold text-blue-700 transform -rotate-1"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
                Contact Us 📧
              </span>
            </h1>
          </div>

          {/* Email Contact */}
          <div className="text-center transform -rotate-0.5">
            <div
              className="bg-white p-8 rounded-xl shadow-lg border-2 border-blue-200 max-w-md mx-auto"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              <div className="space-y-4">
                <div className="text-2xl">📮</div>
                <h2 className="text-xl font-bold text-gray-800">
                  Get in Touch!
                </h2>
                <p className="text-gray-600">Feel free to reach out to us</p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <a
                    href="mailto:aitutorly.ai@gmail.com"
                    className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    aitutorly.ai@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
