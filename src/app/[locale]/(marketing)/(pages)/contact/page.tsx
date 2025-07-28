import { ContactFormCard } from '@/components/contact/contact-form-card';
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
 * inspired by https://nsui.irung.me/contact
 */
export default async function ContactPage() {
  const t = await getTranslations('ContactPage');

  return (
    <div className="min-h-screen"
         style={{
           backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      <Container className="py-16 px-4">
        <div className="mx-auto max-w-4xl space-y-8 pb-16">
          {/* Header - 手写风格 */}
          <div className="text-center space-y-6">
            <h1 className="text-3xl md:text-4xl font-bold text-blue-700 transform -rotate-1"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                }}>
              <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
                {t('title')} 📧
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto transform rotate-0.5"
               style={{
                 fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
               }}>
              {t('subtitle')} ✨
            </p>
          </div>

          {/* Form */}
          <div className="transform -rotate-0.5">
            <ContactFormCard />
          </div>
        </div>
      </Container>
    </div>
  );
}
