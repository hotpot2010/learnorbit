#!/usr/bin/env node

/**
 * 重置数据库连接的脚本
 * 用于开发环境中清理僵尸连接
 */

console.log('🔄 重置数据库连接...');

// 终止所有Node.js进程
if (process.platform === 'win32') {
  require('child_process').exec('taskkill /f /im node.exe', (error) => {
    if (error && !error.message.includes('not found')) {
      console.error('❌ 清理进程失败:', error.message);
    } else {
      console.log('✅ Node.js 进程已清理');
    }
  });
} else {
  require('child_process').exec('pkill -f node', (error) => {
    if (error && error.code !== 1) {
      console.error('❌ 清理进程失败:', error.message);
    } else {
      console.log('✅ Node.js 进程已清理');
    }
  });
}

// 清理 .next 缓存
const fs = require('fs');
const path = require('path');

try {
  const nextDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log('✅ .next 缓存已清理');
  }
} catch (error) {
  console.error('❌ 清理缓存失败:', error.message);
}

console.log('🎉 数据库连接重置完成！');
console.log('💡 现在可以运行 pnpm dev 重新启动服务器');
