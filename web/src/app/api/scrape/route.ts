import { NextResponse } from 'next/server';

// Trigger a GitHub Actions workflow dispatch to start a crawl cycle
export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // e.g. "owner/repo"
  const workflowId = process.env.GITHUB_CRAWL_WORKFLOW ?? 'crawl.yml';

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GitHub integration not configured' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('GitHub dispatch failed:', res.status, text);
      return NextResponse.json(
        { error: 'Failed to trigger scrape' },
        { status: 502 },
      );
    }

    return NextResponse.json({ message: 'Scrape cycle triggered via GitHub Actions', running: true });
  } catch (err) {
    console.error('POST /api/scrape error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
