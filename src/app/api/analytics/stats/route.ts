import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { keyActions } from '@/db/schema';
import { sql, and, gte, lte, inArray, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const excludeUserIds = searchParams.get('excludeUserIds');

    const db = await getDb();

    // 构建查询条件
    const conditions = [];
    
    if (startDate) {
      const start = new Date(startDate);
      conditions.push(gte(keyActions.serverTimestamp, start));
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // 包含整天
      conditions.push(lte(keyActions.serverTimestamp, end));
    }

    // 排除特定用户
    if (excludeUserIds) {
      const excludeIds = excludeUserIds.split(',').map(id => id.trim()).filter(Boolean);
      if (excludeIds.length > 0) {
        // 使用 sql.raw 来构建 NOT IN 查询
        const placeholders = excludeIds.map((_, i) => `$${i + 1}`).join(', ');
        conditions.push(sql.raw(`user_id NOT IN (${excludeIds.map(id => `'${id}'`).join(', ')})`));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. 总访问用户数
    const totalUsersResult = await db
      .selectDistinct({ userId: keyActions.userId })
      .from(keyActions)
      .where(whereClause);
    
    const totalUsers = totalUsersResult.length;

    // 2. 各个操作的用户数
    const actionUsersResult = await db
      .select({
        eventName: keyActions.eventName,
        userId: keyActions.userId,
      })
      .from(keyActions)
      .where(whereClause);

    // 按事件类型分组统计唯一用户数
    const actionUserCounts: Record<string, Set<string>> = {};
    actionUsersResult.forEach(row => {
      if (!actionUserCounts[row.eventName]) {
        actionUserCounts[row.eventName] = new Set();
      }
      actionUserCounts[row.eventName].add(row.userId);
    });

    const actionStats = Object.entries(actionUserCounts).map(([eventName, users]) => ({
      eventName,
      userCount: users.size,
    }));

    // 3. 多天访问用户（访问日期 >= 2 天的用户）
    const userDaysResult = await db
      .select({
        userId: keyActions.userId,
        date: sql<string>`DATE(${keyActions.serverTimestamp})`,
      })
      .from(keyActions)
      .where(whereClause);

    // 统计每个用户的访问天数
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

    // 4. 漏斗数据 - 每个操作类型分开统计
    const funnelData: Record<string, Set<string>> = {};
    
    actionUsersResult.forEach(row => {
      if (!funnelData[row.eventName]) {
        funnelData[row.eventName] = new Set<string>();
      }
      funnelData[row.eventName].add(row.userId);
    });

    const funnel = Object.entries(funnelData).reduce((acc, [eventName, users]) => {
      acc[eventName] = users.size;
      return acc;
    }, {} as Record<string, number>);

    // 5. 用户详情列表 - 包含操作次数统计
    const userDetails = Object.entries(userVisitDays).map(([userId, days]) => {
      const userActions = actionUsersResult.filter(row => row.userId === userId);
      
      // 统计每个操作的次数
      const actionCounts: Record<string, number> = {};
      userActions.forEach(row => {
        actionCounts[row.eventName] = (actionCounts[row.eventName] || 0) + 1;
      });

      return {
        userId,
        dayCount: days.size,
        isMultiDay: days.size >= 2,
        actions: userActions.map(row => row.eventName),
        actionCounts, // 新增：每个操作的次数
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        actionStats,
        multiDayUsers,
        funnel,
        userDetails,
      },
    });
  } catch (error) {
    console.error('❌ 统计查询失败:', error);
    return NextResponse.json(
      { success: false, error: '统计查询失败' },
      { status: 500 }
    );
  }
}

