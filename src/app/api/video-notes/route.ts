import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import backendAPI from '@/lib/backend-api';

// POST /api/video-notes - 保存或更新视频笔记
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const body = await request.json();
    
    const {
      taskId,
      videoUrl,
      bvId,
      videoTitle,
      videoPlatform,
      userNotesData,
      title,
      description,
    } = body;
    
    // 验证必填字段
    if (!taskId || !videoUrl || !userNotesData) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, videoUrl, userNotesData' },
        { status: 400 }
      );
    }
    
    // 通过 Backend API 创建或更新笔记
    const result = await backendAPI.videoNotes.createOrUpdate(userId, {
      task_id: taskId,
      video_url: videoUrl,
      bv_id: bvId,
      video_title: videoTitle,
      video_platform: videoPlatform,
      user_notes_data: userNotesData,
      title,
      description,
    });
    
    console.log(`✅ Video note ${result.isNew ? 'created' : 'updated'}:`, result.noteId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error saving video note:', error);
    return NextResponse.json(
      { error: 'Failed to save note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/video-notes - 获取用户的所有笔记或特定视频的笔记
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const taskId = searchParams.get('taskId'); // 查询特定视频的笔记
    
    // 通过 Backend API 获取笔记
    const result = await backendAPI.videoNotes.getUserNotes(userId, taskId || undefined, page, limit);
    
    // 转换字段名：snake_case -> camelCase
    if (result.success && result.notes) {
      const transformedNotes = result.notes.map((note: any) => ({
        id: note.id,
        taskId: note.task_id,
        videoUrl: note.video_url,
        bvId: note.bv_id,
        videoTitle: note.video_title,
        videoPlatform: note.video_platform || 'bilibili',
        title: note.title,
        description: note.description,
        userNotesData: note.user_notes_data,
        totalKnowledgePoints: note.total_knowledge_points || 0,
        totalQAs: note.total_qas || 0,
        totalExercises: note.total_exercises || 0,
        isFavorite: note.is_favorite || false,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        lastViewedAt: note.last_viewed_at,
      }));
      
      return NextResponse.json({
        success: true,
        notes: transformedNotes,
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error fetching video notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
