'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Users, TrendingUp, Filter, Download } from 'lucide-react';

// 默认排除的用户ID
const DEFAULT_EXCLUDE_USER_IDS = [
  'KoGRueO3tCh6UOQrZOeTihCUpid7rWvY',
  'rHirWA0eUVV7wyBXlbTXLmgk0Hya6ql7',
  'XFTXYfkdLeLAvN5NFiObDqdNcu6VTzO0',
];

interface StatsData {
  totalUsers: number;
  actionStats: Array<{ eventName: string; userCount: number }>;
  multiDayUsers: Array<{ userId: string; dayCount: number }>;
  funnel: Record<string, number>;
  userDetails: Array<{
    userId: string;
    dayCount: number;
    isMultiDay: boolean;
    actions: string[];
    actionCounts: Record<string, number>;
  }>;
}

// 事件名称映射
const EVENT_NAMES: Record<string, string> = {
  generate_course: '生成课程',
  start_learning: '开始学习',
  continue_learning: '继续学习',
  start_video_learning: '开始视频学习',
  video_search: '视频搜索',
  video_ask_question: '视频提问',
  video_screenshot: '视频截图',
  video_exercise: '视频练习',
};

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [excludeUserIds, setExcludeUserIds] = useState(DEFAULT_EXCLUDE_USER_IDS.join(','));
  const [searchUserId, setSearchUserId] = useState('');

  // 注释掉权限检查，允许所有人访问
  // 如果需要限制访问，可以取消注释下面的代码
  // if (!user) {
  //   redirect('/');
  // }

  useEffect(() => {
    // 设置默认日期范围（最近7天）
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchStats();
    }
  }, [startDate, endDate]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        excludeUserIds,
      });

      const response = await fetch(`/api/analytics/stats?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        console.error('Failed to fetch stats:', data.error);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchStats();
  };

  const handleExport = () => {
    if (!stats) return;

    const csvContent = [
      ['用户ID', '访问天数', '是否多天访问', '操作统计'].join(','),
      ...stats.userDetails.map(user => {
        const actionStats = Object.entries(user.actionCounts)
          .map(([action, count]) => `${EVENT_NAMES[action] || action}×${count}`)
          .join(';');
        return [
          user.userId,
          user.dayCount,
          user.isMultiDay ? '是' : '否',
          actionStats
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics_${startDate}_${endDate}.csv`;
    link.click();
  };

  // 过滤用户详情（根据搜索条件）
  const filteredUserDetails = stats?.userDetails.filter(user => {
    if (!searchUserId) return true;
    return user.userId.toLowerCase().includes(searchUserId.toLowerCase());
  }) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据统计分析</h1>
          <p className="text-muted-foreground mt-2">用户行为分析与转化漏斗</p>
        </div>
        <Button onClick={handleExport} disabled={!stats} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          导出数据
        </Button>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excludeUserIds">排除用户ID（逗号分隔）</Label>
            <Input
              id="excludeUserIds"
              placeholder="输入要排除的用户ID，用逗号分隔"
              value={excludeUserIds}
              onChange={(e) => setExcludeUserIds(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              默认排除: {DEFAULT_EXCLUDE_USER_IDS.join(', ')}
            </p>
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto">
            {loading ? '加载中...' : '查询统计'}
          </Button>
        </CardContent>
      </Card>

      {/* 概览统计 */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总访问用户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {startDate} 至 {endDate}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">多天访问用户</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.multiDayUsers.length}</div>
                <p className="text-xs text-muted-foreground">
                  访问≥2天的用户数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">留存率</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalUsers > 0
                    ? ((stats.multiDayUsers.length / stats.totalUsers) * 100).toFixed(1)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  多天访问用户占比
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 转化漏斗 */}
          <Card>
            <CardHeader>
              <CardTitle>转化漏斗</CardTitle>
              <CardDescription>用户行为转化路径分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 顶层：生成课程 */}
                {stats.funnel.generate_course > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>{EVENT_NAMES['generate_course'] || 'generate_course'}</span>
                      <span className="text-gray-500">{stats.funnel.generate_course} 用户</span>
                    </div>
                    <div className="w-full bg-yellow-50 rounded h-8 overflow-hidden">
                      <div
                        className="bg-yellow-200 h-full flex items-center pl-3 text-gray-700 text-xs font-medium"
                        style={{ width: '100%' }}
                      >
                        100%
                      </div>
                    </div>
                  </div>
                )}

                {/* 中层：开始学习 & 开始视频学习 */}
                {stats.funnel.start_learning > 0 && (
                  <div className="space-y-1.5 pl-6">
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>{EVENT_NAMES['start_learning'] || 'start_learning'}</span>
                      <span className="text-gray-500">{stats.funnel.start_learning} 用户</span>
                    </div>
                    <div className="w-full bg-green-50 rounded h-7 overflow-hidden">
                      <div
                        className="bg-green-200 h-full flex items-center pl-3 text-gray-700 text-xs font-medium"
                        style={{
                          width: stats.funnel.generate_course > 0
                            ? `${Math.min((stats.funnel.start_learning / stats.funnel.generate_course) * 100, 100)}%`
                            : '0%'
                        }}
                      >
                        {stats.funnel.generate_course > 0
                          ? `${((stats.funnel.start_learning / stats.funnel.generate_course) * 100).toFixed(1)}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                )}

                {stats.funnel.start_video_learning > 0 && (
                  <div className="space-y-1.5 pl-6">
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>{EVENT_NAMES['start_video_learning'] || 'start_video_learning'}</span>
                      <span className="text-gray-500">{stats.funnel.start_video_learning} 用户</span>
                    </div>
                    <div className="w-full bg-green-50 rounded h-7 overflow-hidden">
                      <div
                        className="bg-green-200 h-full flex items-center pl-3 text-gray-700 text-xs font-medium"
                        style={{
                          width: stats.funnel.generate_course > 0
                            ? `${Math.min((stats.funnel.start_video_learning / stats.funnel.generate_course) * 100, 100)}%`
                            : '0%'
                        }}
                      >
                        {stats.funnel.generate_course > 0
                          ? `${((stats.funnel.start_video_learning / stats.funnel.generate_course) * 100).toFixed(1)}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 其他操作 - 分开展示 */}
                {Object.entries(stats.funnel)
                  .filter(([key]) => !['generate_course', 'start_learning', 'start_video_learning'].includes(key))
                  .sort((a, b) => b[1] - a[1])
                  .map(([eventName, count]) => (
                    <div key={eventName} className="space-y-1.5 pl-12">
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <span>{EVENT_NAMES[eventName] || eventName}</span>
                        <span className="text-gray-500">{count} 用户</span>
                      </div>
                      <div className="w-full bg-blue-50 rounded h-6 overflow-hidden">
                        <div
                          className="bg-blue-200 h-full flex items-center pl-2 text-gray-700 text-xs"
                          style={{
                            width: stats.funnel.generate_course > 0
                              ? `${Math.min((count / stats.funnel.generate_course) * 100, 100)}%`
                              : '0%'
                          }}
                        >
                          {stats.funnel.generate_course > 0
                            ? `${((count / stats.funnel.generate_course) * 100).toFixed(1)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* 各操作用户统计 */}
          <Card>
            <CardHeader>
              <CardTitle>各操作用户统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.actionStats.map((action) => (
                  <div
                    key={action.eventName}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <span className="text-sm font-medium">
                      {EVENT_NAMES[action.eventName] || action.eventName}
                    </span>
                    <Badge variant="secondary">{action.userCount}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 用户详情列表 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>用户详情</CardTitle>
                  <CardDescription>
                    共 {filteredUserDetails.length} 个用户
                    {stats.multiDayUsers.length > 0 && (
                      <span className="text-green-600 ml-2">
                        （{stats.multiDayUsers.length} 个多天访问）
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="w-64">
                  <Input
                    placeholder="搜索用户ID..."
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">用户ID</th>
                      <th className="text-left p-2">访问天数</th>
                      <th className="text-left p-2">操作统计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserDetails.map((user) => (
                      <tr
                        key={user.userId}
                        className={`border-b ${
                          user.isMultiDay ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{user.userId}</span>
                            {user.isMultiDay && (
                              <Badge variant="default" className="bg-green-600">
                                多天访问
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary">{user.dayCount} 天</Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(user.actionCounts)
                              .sort((a, b) => b[1] - a[1])
                              .map(([action, count]) => (
                                <Badge key={action} variant="outline" className="text-xs">
                                  {EVENT_NAMES[action] || action} × {count}
                                </Badge>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!stats && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            选择日期范围并点击"查询统计"以查看数据
          </CardContent>
        </Card>
      )}
    </div>
  );
}

