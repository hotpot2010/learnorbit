import { getDb } from '../src/db';
import { user } from '../src/db/schema';
import { eq, or } from 'drizzle-orm';

// 创作者邮箱列表
const CREATOR_EMAILS = [
  'zhouletao20@gmail.com',
  'ritafeng1234@gmail.com'
];

async function setupCreators() {
  try {
    const db = await getDb();

    console.log('🔧 Setting up creator accounts...');

    // 查找这些邮箱的用户
    const users = await db
      .select()
      .from(user)
      .where(
        or(
          ...CREATOR_EMAILS.map(email => eq(user.email, email))
        )
      );

    console.log(`📧 Found ${users.length} users with creator emails:`, users.map(u => u.email));

    // 更新这些用户为创作者
    for (const creatorEmail of CREATOR_EMAILS) {
      const result = await db
        .update(user)
        .set({ isCreator: true })
        .where(eq(user.email, creatorEmail))
        .returning();

      if (result.length > 0) {
        console.log(`✅ Set ${creatorEmail} as creator`);
      } else {
        console.log(`⚠️  User ${creatorEmail} not found in database`);
      }
    }

    console.log('🎉 Creator setup complete!');

  } catch (error) {
    console.error('❌ Error setting up creators:', error);
    process.exit(1);
  }
}

setupCreators();
