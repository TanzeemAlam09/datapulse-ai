import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT id, username, email, role, created_at, last_login
    FROM users WHERE id = ${user.userId}
  `;
  if (!rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json(rows[0]);
}
