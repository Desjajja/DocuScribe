// Deprecated detail endpoint: instruct to use /api/fetch_doc_content/:id
import { NextResponse } from 'next/server';

export async function GET(_req: Request, context: { params: any }) {
  const paramsObj = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const rawId = paramsObj?.id;
  const replacement = rawId ? `/api/fetch_doc_content/${encodeURIComponent(rawId)}` : '/api/fetch_doc_content/:id';
  return NextResponse.json({
    error: 'Deprecated endpoint. Use fetch_doc_content',
    replacement,
  }, { status: 410 });
}

