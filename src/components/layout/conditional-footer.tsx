'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './footer';

export function ConditionalFooter() {
  const pathname = usePathname();
  
  // 只在首页显示 Footer
  // 匹配模式: /locale 或 /locale/ (首页)
  const isHomePage = pathname === '/' || pathname.match(/^\/[a-z]{2}(\/)?$/);
  
  if (!isHomePage) {
    return null;
  }
  
  return <Footer />;
}