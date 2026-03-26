import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const rows = await query(
      'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT $1',
      [limit],
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/scrape-runs error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
