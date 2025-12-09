import { type NextRequest, NextResponse } from 'next/server';

// 使用后端API URL配置（来自 .env.local）
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '';
    
    console.log('🔍 查询已处理视频:', { keyword, BACKEND_API_URL });

    // 调用后端API获取所有已处理的视频任务
    const backendUrl = `${BACKEND_API_URL}/open-api/offline-video/tasks?limit=100&offset=0`;
    console.log('📡 请求URL:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📥 后端响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 后端API错误:', errorText);
      throw new Error(`Backend API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 后端返回数据:', {
      success: data.success,
      total: data.total,
      tasksCount: data.tasks?.length || 0,
    });

    if (!data.success || !Array.isArray(data.tasks)) {
      return NextResponse.json({
        success: false,
        videos: [],
        message: '获取已处理视频失败',
      });
    }

    // 筛选已完成的任务（所有三个步骤都成功或部分成功）
    const completedTasks = data.tasks.filter((task: any) => {
      const downloadStatus = task.steps?.download?.status;
      const asrStatus = task.steps?.asr?.status;
      const kpStatus = task.steps?.knowledge_points?.status;
      
      return (
        (downloadStatus === 'success' || downloadStatus === 'partial_success') &&
        (asrStatus === 'success' || asrStatus === 'partial_success') &&
        (kpStatus === 'success' || kpStatus === 'partial_success')
      );
    });

    // 如果有关键词，进行标题筛选
    let filteredTasks = completedTasks;
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filteredTasks = completedTasks.filter((task: any) => {
        const title = task.title || task.video_title || '';
        return title.toLowerCase().includes(lowerKeyword);
      });
    }

    // 转换为前端需要的格式
    const videos = filteredTasks.map((task: any) => {
      // 从 video_info 获取封面URL（优先使用CDN）
      const videoInfo = task.video_info || {};
      const thumbnailCdn = videoInfo.thumbnail_cdn || '';
      const thumbnail = videoInfo.thumbnail || '';
      const coverUrl = thumbnailCdn || thumbnail;

      return {
        title: task.title || task.video_title || '未知标题',
        url: task.bilibili_url,
        cover: coverUrl, // 使用 video_info 中的封面
        thumbnail_cdn: thumbnailCdn, // 额外提供 CDN URL
        duration: task.duration || '00:00:00',
        author: task.author || videoInfo.uploader || '未知',
        play: task.play_count || videoInfo.view_count || 0,
        video_amount: task.series_parts?.length || 1,
        is_series: Array.isArray(task.series_parts) && task.series_parts.length > 1,
        target_audience: task.target_audience || '全部',
        description: task.description || videoInfo.description || '',
        // 额外字段：已处理数据
        task_id: task.task_id,
        video_url: task.video_url,
        asr_result_url: task.asr_result_url,
        knowledge_points_result_url: task.knowledge_points_result_url,
        processed: true, // 标记为已处理
      };
    });

    console.log('✅ 返回已处理视频:', {
      totalCompleted: completedTasks.length,
      filteredCount: videos.length,
      keyword,
    });

    return NextResponse.json({
      success: true,
      videos,
      total: videos.length,
      source: 'database',
    });
  } catch (error: any) {
    console.error('❌ 查询已处理视频失败:', error);
    return NextResponse.json(
      {
        success: false,
        videos: [],
        message: error.message || '查询失败',
      },
      { status: 500 }
    );
  }
}

