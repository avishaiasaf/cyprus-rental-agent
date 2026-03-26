import { NextResponse } from 'next/server';
import { query, normalizeListing } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    const rows = await query('SELECT * FROM listings WHERE id = $1', [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeListing(rows[0]));
  } catch (err) {
    console.error('GET /api/listings/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
