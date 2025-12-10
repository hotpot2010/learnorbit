import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { userVideoNotes, VideoNoteData } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

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
    
    const db = await getDb();
    
    // 检查是否已存在（同一用户对同一视频的笔记）
    const existing = await db
      .select()
      .from(userVideoNotes)
      .where(
        and(
          eq(userVideoNotes.userId, userId),
          eq(userVideoNotes.taskId, taskId)
        )
      )
      .limit(1);
    
    // 计算统计信息
    const knowledgePointNotes = userNotesData.knowledgePointNotes || [];
    const stats = {
      totalKnowledgePoints: knowledgePointNotes.length,
      totalQAs: knowledgePointNotes.reduce(
        (sum: number, kp: any) => sum + (kp.qaList?.length || 0),
        0
      ),
      totalExercises: knowledgePointNotes.reduce(
        (sum: number, kp: any) => sum + (kp.exercises?.length || 0),
        0
      ),
    };
    
    let noteId: string;
    
    if (existing.length > 0) {
      // 更新现有笔记
      noteId = existing[0].id;
      await db
        .update(userVideoNotes)
        .set({
          userNotesData,
          title: title || existing[0].title,
          description: description || existing[0].description,
          videoTitle: videoTitle || existing[0].videoTitle,
          ...stats,
          updatedAt: new Date(),
        })
        .where(eq(userVideoNotes.id, noteId));
      
      console.log('✅ Video note updated:', noteId);
      
      return NextResponse.json({
        success: true,
        noteId,
        message: 'Note updated successfully',
        isNew: false,
      });
    } else {
      // 创建新笔记
      const [newNote] = await db
        .insert(userVideoNotes)
        .values({
          userId,
          taskId,
          videoUrl,
          bvId: bvId || null,
          videoTitle: videoTitle || null,
          videoPlatform: videoPlatform || 'bilibili',
          userNotesData,
          title: title || null,
          description: description || null,
          ...stats,
        })
        .returning({ id: userVideoNotes.id });
      
      noteId = newNote.id;
      
      console.log('✅ Video note created:', noteId);
      
      return NextResponse.json({
        success: true,
        noteId,
        message: 'Note saved successfully',
        isNew: true,
      });
    }
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
    
    const db = await getDb();
    
    // 构建查询
    let query = db
      .select()
      .from(userVideoNotes)
      .where(eq(userVideoNotes.userId, userId));
    
    // 如果指定了 taskId，查询特定视频的笔记
    if (taskId) {
      const notes = await db
        .select()
        .from(userVideoNotes)
        .where(
          and(
            eq(userVideoNotes.userId, userId),
            eq(userVideoNotes.taskId, taskId)
          )
        )
        .orderBy(desc(userVideoNotes.updatedAt));
      
      return NextResponse.json({
        success: true,
        notes,
      });
    }
    
    // 获取所有笔记（分页）
    const notes = await query
      .orderBy(desc(userVideoNotes.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);
    
    return NextResponse.json({
      success: true,
      notes,
      page,
      limit,
    });
  } catch (error) {
    console.error('❌ Error fetching video notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

