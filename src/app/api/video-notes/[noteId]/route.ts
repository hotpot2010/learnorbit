import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import backendAPI from '@/lib/backend-api';

// GET /api/video-notes/[noteId] - 获取单个笔记
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
) {
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
    
    const { noteId } = await context.params;
    
    // 通过 Backend API 获取笔记（会自动更新最后查看时间）
    const note = await backendAPI.videoNotes.get(noteId, session.user.id);
    
    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    console.error('❌ Error fetching note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

// DELETE /api/video-notes/[noteId] - 删除笔记
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
) {
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
    
    const { noteId } = await context.params;
    
    // 通过 Backend API 删除笔记
    await backendAPI.videoNotes.delete(noteId, session.user.id);
    
    console.log('✅ Video note deleted:', noteId);
    
    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}

