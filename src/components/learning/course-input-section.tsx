'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { useLocaleRouter } from '@/i18n/navigation';
import { useAuthCheck } from '@/components/shared/login-check';
import { useTranslations } from 'next-intl';

interface CourseInputSectionProps {
  className?: string;
}

export function CourseInputSection({ className }: CourseInputSectionProps) {
  const t = useTranslations('LearningPlatform');
  const router = useLocaleRouter();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { requireAuth } = useAuthCheck();

  const handleSubmit = async () => {
    if (!input.trim()) return;

    // 检查登录状态
    requireAuth(() => {
      setIsLoading(true);

      // 保存用户输入并立即跳转
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('learningInput', input);
        sessionStorage.removeItem('aiResponse'); // 清除之前的响应
      }

      console.log('首页输入框调用chat1接口:', input);
      console.log('首页API调用: /api/chat1/stream');

      // 立即跳转到课程定制页面
      router.push('/custom');
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative">
        <Textarea
          placeholder={t('inputPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[80px] resize-none text-sm px-4 py-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
          disabled={isLoading}
        />

        <div className="absolute bottom-3 right-3">
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" />
                {t('generatePlan')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
