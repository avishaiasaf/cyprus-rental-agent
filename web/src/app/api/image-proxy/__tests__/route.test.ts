import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '../route';

// Mock NextRequest/NextResponse - route.ts uses Next.js imports
// We test by constructing Request objects and calling the handler directly

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(urlStr: string) {
  return new Request(urlStr) as any;
}

describe('GET /api/image-proxy', () => {
  it('missing url param returns 400', async () => {
    const res = await GET(makeRequest('http://localhost/api/image-proxy'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('invalid URL (non-http scheme) returns 400', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/image-proxy?url=' + encodeURIComponent('ftp://example.com/img.jpg')),
    );
    expect(res.status).toBe(400);
  });

  it('private/loopback IP URL returns 400', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/image-proxy?url=' + encodeURIComponent('http://127.0.0.1/img.jpg')),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/private|loopback/i);
  });

  it('successful upstream returns 200 with correct headers', async () => {
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('fake-image-data'));
        controller.close();
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body: mockBody,
      }),
    );

    const res = await GET(
      makeRequest('http://localhost/api/image-proxy?url=' + encodeURIComponent('https://example.com/photo.jpg')),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('max-age=86400');
  });

  it('upstream fetch failure returns 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
      }),
    );

    const res = await GET(
      makeRequest('http://localhost/api/image-proxy?url=' + encodeURIComponent('https://example.com/fail.jpg')),
    );
    expect(res.status).toBe(502);
  });
});
