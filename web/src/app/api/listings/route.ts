import { NextResponse } from 'next/server';
import { query, normalizeListing } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = Object.fromEntries(searchParams.entries());

    const perPage = Math.min(parseInt(q.per_page ?? '50', 10), 200);
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const offset = (page - 1) * perPage;

    const minPrice = q.min_price ? parseFloat(q.min_price) : undefined;
    const maxPrice = q.max_price ? parseFloat(q.max_price) : undefined;
    const minBedrooms = q.min_bedrooms ? parseInt(q.min_bedrooms, 10) : undefined;
    const maxBedrooms = q.max_bedrooms ? parseInt(q.max_bedrooms, 10) : undefined;
    const minBathrooms = q.min_bathrooms ? parseInt(q.min_bathrooms, 10) : undefined;
    const maxBathrooms = q.max_bathrooms ? parseInt(q.max_bathrooms, 10) : undefined;
    const minArea = q.min_area ? parseFloat(q.min_area) : undefined;
    const maxArea = q.max_area ? parseFloat(q.max_area) : undefined;
    const furnished = q.furnished === 'true' ? true : q.furnished === 'false' ? false : undefined;
    const exclude = q.exclude ? parseInt(q.exclude, 10) : undefined;

    // Validate
    if (minPrice != null && minPrice < 0) {
      return NextResponse.json({ error: 'min_price cannot be negative' }, { status: 400 });
    }
    if (maxPrice != null && maxPrice < 0) {
      return NextResponse.json({ error: 'max_price cannot be negative' }, { status: 400 });
    }
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      return NextResponse.json({ error: 'min_price must be <= max_price' }, { status: 400 });
    }

    // Build WHERE conditions dynamically
    const conditions: string[] = ['is_active = TRUE'];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Full-text search
    let orderBy = 'first_seen_at DESC';
    if (q.q) {
      conditions.push(`search_vector @@ websearch_to_tsquery('english', $${paramIdx++})`);
      params.push(q.q);
      orderBy = `ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC`;
    }

    if (q.type && q.type !== 'any') {
      conditions.push(`listing_type = $${paramIdx++}`);
      params.push(q.type);
    }
    if (q.district) {
      conditions.push(`district = $${paramIdx++}`);
      params.push(q.district);
    }
    if (q.property_type) {
      conditions.push(`property_type = $${paramIdx++}`);
      params.push(q.property_type);
    }
    if (minPrice != null) {
      conditions.push(`price >= $${paramIdx++}`);
      params.push(minPrice);
    }
    if (maxPrice != null) {
      conditions.push(`price <= $${paramIdx++}`);
      params.push(maxPrice);
    }
    if (minBedrooms != null) {
      conditions.push(`bedrooms >= $${paramIdx++}`);
      params.push(minBedrooms);
    }
    if (maxBedrooms != null) {
      conditions.push(`bedrooms <= $${paramIdx++}`);
      params.push(maxBedrooms);
    }
    if (minBathrooms != null) {
      conditions.push(`bathrooms >= $${paramIdx++}`);
      params.push(minBathrooms);
    }
    if (maxBathrooms != null) {
      conditions.push(`bathrooms <= $${paramIdx++}`);
      params.push(maxBathrooms);
    }
    if (minArea != null) {
      conditions.push(`area_sqm >= $${paramIdx++}`);
      params.push(minArea);
    }
    if (maxArea != null) {
      conditions.push(`area_sqm <= $${paramIdx++}`);
      params.push(maxArea);
    }
    if (furnished != null) {
      conditions.push(`furnished = $${paramIdx++}`);
      params.push(furnished);
    }
    if (q.source) {
      conditions.push(`source = $${paramIdx++}`);
      params.push(q.source);
    }
    if (exclude != null) {
      conditions.push(`id != $${paramIdx++}`);
      params.push(exclude);
    }

    // Sort
    if (q.sort) {
      const sortMap: Record<string, string> = {
        price_asc: 'price ASC NULLS LAST',
        price_desc: 'price DESC NULLS LAST',
        newest: 'first_seen_at DESC',
        oldest: 'first_seen_at ASC',
      };
      orderBy = sortMap[q.sort] || orderBy;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Execute count + listings in parallel using raw SQL
    const countQuery = `SELECT COUNT(*) as c FROM listings ${where}`;
    const listingsQuery = `SELECT * FROM listings ${where} ORDER BY ${orderBy} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;

    const [countRes, listingsRes] = await Promise.all([
      query(countQuery, params),
      query(listingsQuery, [...params, perPage, offset]),
    ]);

    const total = Number(countRes[0].c);

    return NextResponse.json({
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
      listings: listingsRes.map(normalizeListing),
    });
  } catch (err) {
    console.error('GET /api/listings error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
