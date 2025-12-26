import Container from '@/components/layout/container';
import { CourseInputSection } from '@/components/learning/course-input-section';
import { constructMetadata } from '@/lib/metadata';
import { getCanonicalUrl } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#metadata-api
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LearningPlatform' });

  return constructMetadata({
    title: t('meta.title'),
    description: t('meta.description'),
    canonicalUrl: getCanonicalUrl('custom_search', locale),
  });
}

interface CustomSearchPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function CustomSearchPage(props: CustomSearchPageProps) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: 'LearningPlatform' });
  
  // 字体配置：移动端英文使用 Times New Roman，中文统一使用卡通字体
  const getFontFamily = (isEnglish: boolean) => {
    if (isEnglish) {
      // 移动端英文使用 Times New Roman
      return '"Times New Roman", Times, serif';
    } else {
      // 中文统一使用卡通字体
      return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
    }
  };

  return (
    <div
      className="relative min-h-screen"
      data-locale={locale}
      style={{
        backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 主要内容区域 - 桌面端放大10%，移动端正常 */}
      <div className="transform scale-100 lg:scale-110 origin-top">
        {/* 头部区域 - 手写笔记风格 */}
        <section className="relative py-8 md:py-16 lg:py-24 lg:min-h-0 min-h-[calc(100vh-4rem)] flex items-center">
          {/* 头部内容 */}
          <Container className="relative z-10 w-full">
            <div className="text-center space-y-6 w-full max-w-4xl mx-auto px-4 lg:px-0">
              {/* 手写标题 */}
              <div className="space-y-4">
                <h1
                  className="text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-bold text-slate-800 leading-tight homepage-title"
                  style={{
                    fontFamily: getFontFamily(locale === 'en'),
                  }}
                >
                  <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
                    {t('hero.title')} ✨
                  </span>
                </h1>

                {/* 手写副标题 */}
                <p
                  className="text-lg md:text-xl lg:text-xl text-gray-600 max-w-2xl mx-auto homepage-subtitle"
                  style={{
                    fontFamily: getFontFamily(locale === 'en'),
                  }}
                >
                  {t('hero.subtitle')} 📚
                </p>
              </div>

              {/* 输入框区域 */}
              <div className="pt-6">
                <CourseInputSection />
              </div>
            </div>
          </Container>
        </section>
      </div>
    </div>
  );
}

