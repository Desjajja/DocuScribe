import { NextResponse } from 'next/server';
import { listAllDocs } from '@/app/actions';

// Primary list endpoint (stable underscore form)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const documents = await listAllDocs(limit, offset);
    return NextResponse.json({ documents });
  } catch (err) {
    console.error('list_all_docs error', err);
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}
