import { NextResponse } from 'next/server';

// Deprecated: redirect to new underscore variant
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const dest = `/api/list_all_docs${qs ? `?${qs}` : ''}`;
  return NextResponse.redirect(dest, 308);
}

