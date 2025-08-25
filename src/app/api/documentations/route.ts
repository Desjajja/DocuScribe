import { NextResponse } from 'next/server';
// Deprecated endpoint: instruct clients to use /api/list_all_docs
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const replacement = `/api/list_all_docs${qs ? `?${qs}` : ''}`;
  return new Response(JSON.stringify({
    error: 'Deprecated endpoint. Use /api/list_all_docs',
    replacement,
  }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}

