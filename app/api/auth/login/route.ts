import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, username, email, password, role, is_active
      FROM users
      WHERE (username = ${username} OR email = ${username})
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = rows[0];
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;

    // Audit log
    await sql`
      INSERT INTO audit_log (user_id, action, ip_addr)
      VALUES (${user.id}, 'login', ${req.headers.get('x-forwarded-for') || 'unknown'})
    `;

    const token = signToken({ userId: user.id, role: user.role, username: user.username });

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
