import { NextResponse } from 'next/server';
import { listDocumentations } from '@/app/actions';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const documentations = await listDocumentations(limit, offset);
    return NextResponse.json({ documentations });
  } catch (err) {
    console.error('Documentations list error', err);
    return NextResponse.json({ error: 'Failed to list documentations' }, { status: 500 });
  }
}
