import { NextResponse } from 'next/server';
import { getDocumentationByName } from '@/app/actions';

export async function GET(_req: Request, context: { params: any }) {
  // params may be a plain object or a Promise depending on the Next version/build step
  const paramsObj = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const rawName = paramsObj?.name;
  if (!rawName) return NextResponse.json({ error: 'Missing documentation name' }, { status: 400 });
  const name = decodeURIComponent(rawName);
  try {
    const document = await getDocumentationByName(name);
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ document });
  } catch (err) {
    console.error('Documentation detail error', err);
    return NextResponse.json({ error: 'Failed to fetch documentation' }, { status: 500 });
  }
}
