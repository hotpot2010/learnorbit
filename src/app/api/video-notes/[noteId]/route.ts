import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { userVideoNotes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

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
    const db = await getDb();
    
    const [note] = await db
      .select()
      .from(userVideoNotes)
      .where(
        and(
          eq(userVideoNotes.id, noteId),
          eq(userVideoNotes.userId, session.user.id)
        )
      )
      .limit(1);
    
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // 更新最后查看时间
    await db
      .update(userVideoNotes)
      .set({ lastViewedAt: new Date() })
      .where(eq(userVideoNotes.id, noteId));
    
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
    const db = await getDb();
    
    await db
      .delete(userVideoNotes)
      .where(
        and(
          eq(userVideoNotes.id, noteId),
          eq(userVideoNotes.userId, session.user.id)
        )
      );
    
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

