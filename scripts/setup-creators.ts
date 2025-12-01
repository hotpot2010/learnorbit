/**
 * 创作者设置脚本
 * 
 * 注意：由于数据库架构变更，`isCreator` 字段已被删除。
 * 现在判断是否为创作者完全基于邮箱地址，通过 `isCreatorEmail()` 函数实现。
 * 
 * 创作者邮箱列表定义在 `src/lib/creator-utils.ts` 中。
 * 
 * 此脚本现在仅用于信息展示，不再需要执行数据库更新操作。
 */

import { isCreatorEmail } from '../src/lib/creator-utils';

// 创作者邮箱列表（与 creator-utils.ts 中的列表保持一致）
const CREATOR_EMAILS = [
  'zhouletao20@gmail.com',
  'ritafeng1234@gmail.com'
];

async function setupCreators() {
  try {
    console.log('📋 创作者邮箱列表:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    CREATOR_EMAILS.forEach((email, index) => {
      const isCreator = isCreatorEmail(email);
      console.log(`${index + 1}. ${email} ${isCreator ? '✅' : '❌'}`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('ℹ️  说明：');
    console.log('   - 判断是否为创作者现在完全基于邮箱地址');
    console.log('   - 不需要数据库字段，通过 isCreatorEmail() 函数判断');
    console.log('   - 如需添加新的创作者，请修改 src/lib/creator-utils.ts');
    console.log('');
    console.log('✅ 脚本执行完成（无需数据库操作）');

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

setupCreators();
