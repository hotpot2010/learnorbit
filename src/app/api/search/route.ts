import { NextResponse } from 'next/server';

// TODO: 重新启用当文档数据源配置完成后
// import { docsI18nConfig } from '@/lib/docs/i18n';
// import { source } from '@/lib/source';
// import { createTokenizer } from '@orama/tokenizers/mandarin';
// import { createI18nSearchAPI } from 'fumadocs-core/search/server';

/**
 * 暂时禁用搜索功能 - 返回空结果
 */
export const GET = async (request: Request) => {
  // TODO: 实现完整的搜索功能
  return NextResponse.json({ 
    results: [],
    message: 'Search functionality temporarily disabled' 
  });
};
