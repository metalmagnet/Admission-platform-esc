import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new NextResponse('Not signed in', { status: 401 });

  // Row level security decides whether this agent may see the document at all.
  const { data: doc } = await db
    .from('documents')
    .select('storage_path, original_name, applicant_requirement:applicant_requirements(applicant_id)')
    .eq('id', id)
    .single();
  if (!doc) return new NextResponse('Not found', { status: 404 });

  const download = new URL(request.url).searchParams.has('download');
  const { data, error } = await supabaseAdmin()
    .storage.from('documents')
    .createSignedUrl(doc.storage_path, 60, download ? { download: doc.original_name } : undefined);
  if (error || !data) return new NextResponse('Could not open the file', { status: 500 });

  const link = (doc as unknown as { applicant_requirement: { applicant_id: string } }).applicant_requirement;
  await audit(auth.user.id, download ? 'document.downloaded' : 'document.viewed', link.applicant_id, { document: id });
  return NextResponse.redirect(data.signedUrl);
}
