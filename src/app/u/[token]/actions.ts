'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit } from '@/lib/audit';
import { MAX_UPLOAD_BYTES, safeName, sha256, sniffMime } from '@/lib/files';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashToken } from '@/lib/tokens';

export async function resolveLink(token: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('upload_links')
    .select('id, applicant_id, expires_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function studentUpload(token: string, applicantRequirementId: string, lang: string, formData: FormData) {
  const back = (code: string) => redirect(`/u/${token}?lang=${lang}&r=${code}#${applicantRequirementId}`);

  const link = await resolveLink(token);
  if (!link) redirect(`/u/${token}?lang=${lang}`);

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('applicant_requirements')
    .select('id, applicant_id, status, requirement:template_requirements(provider, kind)')
    .eq('id', applicantRequirementId)
    .single();
  const requirement = (row as unknown as { requirement: { provider: string; kind: string } } | null)?.requirement;
  // The link only ever opens its own applicant's student-provided documents, whatever id is posted.
  if (!row || row.applicant_id !== link.applicant_id || requirement?.provider !== 'student' || requirement.kind !== 'document') {
    return back('item');
  }
  if (row.status === 'approved') return back('item');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return back('empty');
  if (file.size > MAX_UPLOAD_BYTES) return back('big');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return back('type');

  const path = `${row.applicant_id}/${row.id}/${randomUUID()}`;
  const { error: storageError } = await admin.storage.from('documents').upload(path, bytes, { contentType: mime });
  if (storageError) return back('generic');

  const { error } = await admin.rpc('add_document', {
    p_applicant_requirement_id: row.id,
    p_storage_path: path,
    p_original_name: safeName(file.name),
    p_mime_type: mime,
    p_size_bytes: bytes.length,
    p_sha256: sha256(bytes),
    p_agent: null,
  });
  if (error) return back('generic');

  await admin.from('upload_links').update({ last_used_at: new Date().toISOString() }).eq('id', link.id);
  await audit('student', 'document.uploaded_by_student', row.applicant_id, { item: row.id, name: safeName(file.name) });
  revalidatePath(`/u/${token}`);
  return back('ok');
}
