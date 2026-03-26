import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [totalRes, activeRes, bySourceRes] = await Promise.all([
      query('SELECT COUNT(*) as c FROM listings'),
      query('SELECT COUNT(*) as c FROM listings WHERE is_active = TRUE'),
      query('SELECT source, COUNT(*) as c FROM listings WHERE is_active = TRUE GROUP BY source'),
    ]);

    const bySource: Record<string, number> = {};
    for (const row of bySourceRes) {
      bySource[row.source as string] = Number(row.c);
    }

    return NextResponse.json({
      total: Number(totalRes[0].c),
      active: Number(activeRes[0].c),
      bySource,
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
