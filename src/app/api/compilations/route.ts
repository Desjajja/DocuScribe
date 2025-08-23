import { NextResponse } from 'next/server';

// Deprecated: redirect to the new /api/documentations endpoint
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const destination = `/api/documentations${qs ? `?${qs}` : ''}`;
  return NextResponse.redirect(destination, 308);
}
