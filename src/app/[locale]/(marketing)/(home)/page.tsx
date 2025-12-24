import type { Locale } from 'next-intl';
import { redirect } from 'next/navigation';

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(props: HomePageProps) {
  const params = await props.params;
  const { locale } = params;
  
  // 重定向到视频搜索页面
  redirect(`/${locale}/video-entry`);
}
