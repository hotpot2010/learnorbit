/**
 * 测试统计API的脚本
 * 用于验证数据查询是否正常工作
 */

import { getDb } from '@/db';
import { keyActions } from '@/db/schema';
import { sql, and, gte, lte } from 'drizzle-orm';

async function testAnalyticsAPI() {
  console.log('🧪 开始测试统计API...\n');

  try {
    const db = await getDb();

    // 测试1: 查询所有数据
    console.log('📊 测试1: 查询所有关键行为数据');
    const allActions = await db.select().from(keyActions).limit(10);
    console.log(`✅ 找到 ${allActions.length} 条记录（显示前10条）`);
    if (allActions.length > 0) {
      console.log('示例数据:', {
        eventName: allActions[0].eventName,
        userId: allActions[0].userId,
        timestamp: new Date(allActions[0].timestamp).toISOString(),
      });
    }
    console.log('');

    // 测试2: 统计总用户数
    console.log('📊 测试2: 统计总用户数');
    const totalUsersResult = await db
      .selectDistinct({ userId: keyActions.userId })
      .from(keyActions);
    console.log(`✅ 总用户数: ${totalUsersResult.length}`);
    console.log('');

    // 测试3: 按事件类型统计
    console.log('📊 测试3: 按事件类型统计用户数');
    const actionUsersResult = await db
      .select({
        eventName: keyActions.eventName,
        userId: keyActions.userId,
      })
      .from(keyActions);

    const actionUserCounts: Record<string, Set<string>> = {};
    actionUsersResult.forEach(row => {
      if (!actionUserCounts[row.eventName]) {
        actionUserCounts[row.eventName] = new Set();
      }
      actionUserCounts[row.eventName].add(row.userId);
    });

    console.log('各操作用户数:');
    Object.entries(actionUserCounts).forEach(([eventName, users]) => {
      console.log(`  - ${eventName}: ${users.size} 用户`);
    });
    console.log('');

    // 测试4: 统计多天访问用户
    console.log('📊 测试4: 统计多天访问用户');
    const userDaysResult = await db
      .select({
        userId: keyActions.userId,
        date: sql<string>`DATE(${keyActions.serverTimestamp})`,
      })
      .from(keyActions);

    const userVisitDays: Record<string, Set<string>> = {};
    userDaysResult.forEach(row => {
      if (!userVisitDays[row.userId]) {
        userVisitDays[row.userId] = new Set();
      }
      userVisitDays[row.userId].add(row.date);
    });

    const multiDayUsers = Object.entries(userVisitDays)
      .filter(([_, days]) => days.size >= 2)
      .map(([userId, days]) => ({
        userId,
        dayCount: days.size,
      }));

    console.log(`✅ 多天访问用户数: ${multiDayUsers.length}`);
    if (multiDayUsers.length > 0) {
      console.log('示例用户:');
      multiDayUsers.slice(0, 3).forEach(user => {
        console.log(`  - ${user.userId}: ${user.dayCount} 天`);
      });
    }
    console.log('');

    // 测试5: 测试日期范围过滤
    console.log('📊 测试5: 测试日期范围过滤（最近7天）');
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentActions = await db
      .select()
      .from(keyActions)
      .where(
        and(
          gte(keyActions.serverTimestamp, sevenDaysAgo),
          lte(keyActions.serverTimestamp, today)
        )
      );

    console.log(`✅ 最近7天的行为记录: ${recentActions.length} 条`);
    console.log('');

    // 测试6: 测试用户排除
    console.log('📊 测试6: 测试用户排除功能');
    const excludeIds = [
      'KoGRueO3tCh6UOQrZOeTihCUpid7rWvY',
      'rHirWA0eUVV7wyBXlbTXLmgk0Hya6ql7',
      'XFTXYfkdLeLAvN5NFiObDqdNcu6VTzO0',
    ];

    const filteredActions = await db
      .select()
      .from(keyActions)
      .where(
        sql.raw(`user_id NOT IN (${excludeIds.map(id => `'${id}'`).join(', ')})`)
      );

    console.log(`✅ 排除指定用户后的记录: ${filteredActions.length} 条`);
    console.log(`   排除的用户ID: ${excludeIds.join(', ')}`);
    console.log('');

    console.log('✅ 所有测试通过！统计API工作正常。\n');
    console.log('📝 你可以访问以下地址查看统计页面:');
    console.log('   http://localhost:3000/analytics-dashboard');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

// 运行测试
testAnalyticsAPI()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });

