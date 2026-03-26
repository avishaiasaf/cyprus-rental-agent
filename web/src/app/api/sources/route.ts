import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query(
      'SELECT source as name, COUNT(*) as active_listings FROM listings WHERE is_active = TRUE GROUP BY source ORDER BY source',
    );

    return NextResponse.json(
      rows.map((r) => ({ name: r.name, active_listings: Number(r.active_listings) })),
    );
  } catch (err) {
    console.error('GET /api/sources error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
