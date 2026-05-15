import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest, hashPassword } from '@/lib/auth';

function isAdmin(req: NextRequest) {
  const user = getUserFromRequest(req);
  return user?.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const rows = await sql`
    SELECT id, username, email, role, is_active, created_at, last_login
    FROM users ORDER BY created_at DESC
  `;
  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const admin = isAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { username, email, password, role } = await req.json();
  if (!username || !email || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }
  if (!['user','admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const existing = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email}`;
  if (existing.length) return NextResponse.json({ error: 'Username or email taken' }, { status: 409 });

  const hashed = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (username, email, password, role)
    VALUES (${username}, ${email}, ${hashed}, ${role})
    RETURNING id, username, email, role
  `;

  await sql`INSERT INTO audit_log (user_id, action, detail) VALUES (${admin.userId}, 'admin_create_user', ${username})`;

  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const admin = isAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { id, is_active, role, password } = await req.json();
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

  if (is_active !== undefined) {
    await sql`UPDATE users SET is_active = ${is_active} WHERE id = ${id}`;
  }
  if (role && ['user','admin'].includes(role)) {
    await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  }
  if (password && password.length >= 8) {
    const hashed = await hashPassword(password);
    await sql`UPDATE users SET password = ${hashed} WHERE id = ${id}`;
  }

  return NextResponse.json({ message: 'Updated' });
}

export async function DELETE(req: NextRequest) {
  const admin = isAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  if (id === admin.userId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

  await sql`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ message: 'Deleted' });
}
