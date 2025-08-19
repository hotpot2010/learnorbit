'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface WelcomePageProps {
  onStartLearning: () => void;
}

export function WelcomePage({ onStartLearning }: WelcomePageProps) {
  return (
    <div className="learning-content-area h-full flex items-center justify-center">
      {/* 只显示关闭按钮 */}
      <div className="relative">
        <Button
          onClick={onStartLearning}
          variant="ghost"
          size="sm"
          className="flex items-center justify-center p-3 h-12 w-12 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
          title="关闭欢迎页面"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}