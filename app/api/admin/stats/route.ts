import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const [users] = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'user'`;
  const [admins] = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;
  const [docs] = await sql`SELECT COUNT(*) as count FROM documents`;
  const [today] = await sql`SELECT COUNT(*) as count FROM documents WHERE created_at::date = CURRENT_DATE`;

  const recent = await sql`
    SELECT d.original_name, d.status, d.created_at, u.username
    FROM documents d JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC LIMIT 10
  `;

  return NextResponse.json({
    total_users: parseInt(users.count),
    total_admins: parseInt(admins.count),
    total_documents: parseInt(docs.count),
    documents_today: parseInt(today.count),
    recent_activity: recent,
  });
}
