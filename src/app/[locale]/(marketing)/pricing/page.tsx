import FaqSection from '@/components/blocks/faqs/faqs';
import Container from '@/components/layout/container';
import { PricingTable } from '@/components/pricing/pricing-table';

export default async function PricingPage() {
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
        {/* 手写风格标题 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-700 transform -rotate-1 mb-6"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}>
            <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
              Choose Your Plan 💰
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto transform rotate-0.5"
             style={{
               fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
             }}>
            Find the perfect plan for your learning journey! ✨
          </p>
        </div>

        <div className="max-w-6xl mx-auto flex flex-col gap-16">
          <PricingTable />
          <FaqSection />
        </div>
      </Container>
    </div>
  );
}
