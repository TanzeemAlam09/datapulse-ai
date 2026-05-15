import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM users WHERE username = ${username} OR email = ${email.toLowerCase()}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (username, email, password, role)
      VALUES (${username}, ${email.toLowerCase()}, ${hashed}, 'user')
      RETURNING id, username, email, role
    `;

    const user = rows[0];
    const token = signToken({ userId: user.id, role: user.role, username: user.username });

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
