#!/usr/bin/env tsx

/**
 * 测试站点地图生成功能
 * 运行: pnpm test-sitemap
 */

import { config } from 'dotenv';

// 加载环境变量
config({ path: '.env.local' });

async function testSitemap() {
  console.log('🧪 测试站点地图生成...\n');

  try {
    // 设置生产环境变量
    process.env.NODE_ENV = 'production';

    console.log('📋 环境信息:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  - NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || '未设置'}`);
    console.log('');

    // 动态导入sitemap函数
    const sitemapModule = await import('../src/app/sitemap');
    const sitemap = sitemapModule.default;

    console.log('🔄 生成站点地图...');
    const sitemapEntries = await sitemap();

    console.log(`✅ 站点地图生成成功！共 ${sitemapEntries.length} 个条目\n`);

    // 按类型分组显示
    const staticRoutes = sitemapEntries.filter(entry =>
      !entry.url.includes('/study/')
    );
    const courseRoutes = sitemapEntries.filter(entry =>
      entry.url.includes('/study/')
    );

    console.log('📊 站点地图统计:');
    console.log(`  - 静态页面: ${staticRoutes.length} 个`);
    console.log(`  - 课程页面: ${courseRoutes.length} 个`);
    console.log('');

    if (staticRoutes.length > 0) {
      console.log('🏠 静态页面示例:');
      staticRoutes.slice(0, 3).forEach(entry => {
        console.log(`  - ${entry.url} (优先级: ${entry.priority})`);
      });
      console.log('');
    }

    if (courseRoutes.length > 0) {
      console.log('📚 课程页面示例:');
      courseRoutes.slice(0, 5).forEach(entry => {
        console.log(`  - ${entry.url} (优先级: ${entry.priority})`);
      });
      console.log('');
    }

    console.log('🎉 测试完成！站点地图已准备好供谷歌索引。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testSitemap();
