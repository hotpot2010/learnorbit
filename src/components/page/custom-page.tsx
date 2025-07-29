import { formatDate } from '@/lib/formatter';
import type { PagesType } from '@/lib/source';
import { CalendarIcon } from 'lucide-react';
import { getMDXComponents } from '../docs/mdx-components';
import { Card, CardContent } from '../ui/card';

interface CustomPageProps {
  page: PagesType;
}

export function CustomPage({ page }: CustomPageProps) {
  // 类型安全处理
  if (!page || !page.data) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">页面不存在</h1>
          <p className="text-muted-foreground">请求的页面内容不可用。</p>
        </div>
      </div>
    );
  }

  const { title, description, date } = page.data;
  const formattedDate = date ? formatDate(new Date(date)) : '';
  
  // 检查是否存在body属性
  const hasBody = 'body' in page.data && (page.data as any).body;
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-center text-3xl font-bold tracking-tight">
          {title || '无标题'}
        </h1>
        {description && (
          <p className="text-center text-lg text-muted-foreground">
            {description}
          </p>
        )}
        {formattedDate && (
          <div className="flex items-center justify-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <Card className="mb-8">
        <CardContent>
          <div className="max-w-none prose prose-neutral dark:prose-invert prose-img:rounded-lg">
            {hasBody ? (
              <div>MDX内容渲染区域</div>
            ) : (
              <p>暂无内容</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}