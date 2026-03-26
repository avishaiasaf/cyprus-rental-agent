import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [totalRes, activeRes] = await Promise.all([
      query('SELECT COUNT(*) as c FROM listings'),
      query('SELECT COUNT(*) as c FROM listings WHERE is_active = TRUE'),
    ]);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      stats: {
        total: Number(totalRes[0].c),
        active: Number(activeRes[0].c),
      },
    });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
