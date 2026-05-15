import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = user.role === 'admin'
    ? await sql`
        SELECT d.id, d.original_name, d.file_size, d.status,
               d.extracted_data, d.created_at, d.processed_at,
               u.username
        FROM documents d
        JOIN users u ON u.id = d.user_id
        ORDER BY d.created_at DESC
        LIMIT 200
      `
    : await sql`
        SELECT id, original_name, file_size, status,
               extracted_data, created_at, processed_at
        FROM documents
        WHERE user_id = ${user.userId}
        ORDER BY created_at DESC
      `;

  return NextResponse.json({ documents: rows, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const condition = user.role === 'admin'
    ? await sql`DELETE FROM documents WHERE id = ${id} RETURNING id`
    : await sql`DELETE FROM documents WHERE id = ${id} AND user_id = ${user.userId} RETURNING id`;

  if (!condition.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ message: 'Deleted' });
}
