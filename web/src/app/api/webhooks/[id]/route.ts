import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { url, name, filters, is_active } = body;

    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (url !== undefined) {
      sets.push(`url = $${paramIdx++}`);
      values.push(url);
    }
    if (name !== undefined) {
      sets.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (filters !== undefined) {
      sets.push(`filters = $${paramIdx++}`);
      values.push(JSON.stringify(filters));
    }
    if (is_active !== undefined) {
      sets.push(`is_active = $${paramIdx++}`);
      values.push(is_active);
    }

    values.push(id);
    const rows = await query(
      `UPDATE webhook_subscriptions SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PUT /api/webhooks/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rows = await query('DELETE FROM webhook_subscriptions WHERE id = $1 RETURNING id', [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/webhooks/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
