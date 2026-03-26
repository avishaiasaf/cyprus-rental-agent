import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/webhooks error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, name, filters, signing_secret } = body;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const rows = await query(
      `INSERT INTO webhook_subscriptions (url, name, filters, signing_secret)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [url, name ?? '', JSON.stringify(filters ?? {}), signing_secret ?? null],
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/webhooks error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
