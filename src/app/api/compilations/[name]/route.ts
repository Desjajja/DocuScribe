import { NextResponse } from 'next/server';

export async function GET(req: Request, context: { params: any }) {
  const paramsObj = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const name = encodeURIComponent(paramsObj?.name);
  const destination = `/api/documentations/${name}${qs ? `?${qs}` : ''}`;
  return NextResponse.redirect(destination, 308);
}
