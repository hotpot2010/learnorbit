import { Navbar } from '@/components/layout/navbar';
import type { ReactNode } from 'react';
import { ConditionalFooter } from '@/components/layout/conditional-footer';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar scroll={true} />
      <main className="flex-1">{children}</main>
      <ConditionalFooter />
    </div>
  );
}
