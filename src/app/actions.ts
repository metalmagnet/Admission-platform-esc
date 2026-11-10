'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit } from '@/lib/audit';
import { ageOn } from '@/lib/checklist/dates';
import { summarise } from '@/lib/checklist/engine';
import { syncChecklist, loadApplicantRequirements, type Applicant } from '@/lib/data';
import { MAX_UPLOAD_BYTES, safeName, sha256, sniffMime } from '@/lib/files';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { newUploadToken } from '@/lib/tokens';

async function currentUser() {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login');
  return { db, user: data.user };
}

const text = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === null ? null : Number(v);
};

export async function signIn(formData: FormData) {
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) redirect('/login?error=1');
  redirect('/applicants');
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect('/login');
}

function applicantFields(f: FormData) {
  return {
    first_name: text(f, 'first_name'),
    last_name: text(f, 'last_name'),
    date_of_birth: text(f, 'date_of_birth'),
    nationality: text(f, 'nationality'),
    email: text(f, 'email'),
    phone: text(f, 'phone'),
    language: text(f, 'language') ?? 'en',
    parent_name: text(f, 'parent_name'),
    parent_email: text(f, 'parent_email'),
    parent_phone: text(f, 'parent_phone'),
    passport_number: text(f, 'passport_number'),
    passport_expiry: text(f, 'passport_expiry'),
    institution: text(f, 'institution'),
    course_name: text(f, 'course_name'),
    mqf_level: num(f, 'mqf_level'),
    course_start: text(f, 'course_start'),
    course_months: num(f, 'course_months'),
    course_type: text(f, 'course_type'),
    funding: text(f, 'funding'),
    accommodation: text(f, 'accommodation'),
    host_secondary_address: f.get('host_secondary_address') === 'on',
  };
}

export async function findDuplicates(f: { passport_number: string | null; first_name: string; last_name: string; date_of_birth: string }) {
  const { db } = await currentUser();
  const found = new Map<string, { id: string; name: string; reason: string }>();
  if (f.passport_number) {
    const { data } = await db.from('applicants').select('id, first_name, last_name').ilike('passport_number', f.passport_number);
    for (const a of data ?? []) found.set(a.id, { id: a.id, name: `${a.first_name} ${a.last_name}`, reason: 'same passport number' });
  }
  const { data } = await db
    .from('applicants')
    .select('id, first_name, last_name')
    .ilike('first_name', f.first_name)
    .ilike('last_name', f.last_name)
    .eq('date_of_birth', f.date_of_birth);
  for (const a of data ?? []) {
    if (!found.has(a.id)) found.set(a.id, { id: a.id, name: `${a.first_name} ${a.last_name}`, reason: 'same name and date of birth' });
  }
  return [...found.values()];
}

export async function createApplicant(_prev: unknown, formData: FormData) {
  const { db, user } = await currentUser();
  const fields = applicantFields(formData);
  if (!fields.first_name || !fields.last_name || !fields.date_of_birth || !fields.email) {
    return { error: 'First name, last name, date of birth and email are required.', duplicates: [] };
  }

  const age = ageOn(fields.date_of_birth, new Date().toISOString().slice(0, 10));
  if (age < 18 && !fields.parent_email) {
    return { error: 'The applicant is under 18. Add a parent or guardian email.', duplicates: [] };
  }

  if (formData.get('confirm_duplicate') !== 'yes') {
    const duplicates = await findDuplicates({
      passport_number: fields.passport_number,
      first_name: fields.first_name,
      last_name: fields.last_name,
      date_of_birth: fields.date_of_birth,
    });
    if (duplicates.length > 0) return { error: null, duplicates };
  }

  const { data: template } = await db.from('templates').select('id').eq('active', true).eq('country', 'MT').single();
  if (!template) return { error: 'No active Malta checklist template. Run the seed script first.', duplicates: [] };

  const { data: applicant, error } = await db
    .from('applicants')
    .insert({ ...fields, template_id: template.id, agent_id: user.id })
    .select('*')
    .single();
  if (error || !applicant) return { error: error?.message ?? 'Could not create the applicant.', duplicates: [] };

  await syncChecklist(db, applicant as Applicant);
  await audit(user.id, 'applicant.created', applicant.id, { duplicateConfirmed: formData.get('confirm_duplicate') === 'yes' });
  redirect(`/applicants/${applicant.id}`);
}

export async function updateApplicant(applicantId: string, formData: FormData) {
  const { db, user } = await currentUser();
  const fields = {
    ...applicantFields(formData),
    vfs_date: text(formData, 'vfs_date'),
    vfs_fee_type: text(formData, 'vfs_fee_type'),
  };
  const { data, error } = await db.from('applicants').update(fields).eq('id', applicantId).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'Update failed');
  await syncChecklist(db, data as Applicant);
  await audit(user.id, 'applicant.updated', applicantId, { fields: Object.keys(fields) });
  revalidatePath(`/applicants/${applicantId}`);
}

export async function createUploadLink(applicantId: string) {
  const { db, user } = await currentUser();
  const { data: applicant } = await db.from('applicants').select('id').eq('id', applicantId).single();
  if (!applicant) throw new Error('Applicant not found');

  const admin = supabaseAdmin();
  await admin.from('upload_links').update({ revoked_at: new Date().toISOString() }).eq('applicant_id', applicantId).is('revoked_at', null);

  const { token, hash } = newUploadToken();
  const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { error } = await admin
    .from('upload_links')
    .insert({ applicant_id: applicantId, token_hash: hash, created_by: user.id, expires_at: expires });
  if (error) throw new Error(error.message);
  await audit(user.id, 'upload_link.created', applicantId, { expires });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return { url: `${base}/u/${token}`, expires };
}

export async function revokeUploadLinks(applicantId: string) {
  const { db, user } = await currentUser();
  const { data: applicant } = await db.from('applicants').select('id').eq('id', applicantId).single();
  if (!applicant) throw new Error('Applicant not found');
  await supabaseAdmin().from('upload_links').update({ revoked_at: new Date().toISOString() }).eq('applicant_id', applicantId).is('revoked_at', null);
  await audit(user.id, 'upload_link.revoked', applicantId);
  revalidatePath(`/applicants/${applicantId}`);
}

export async function agentUpload(applicantRequirementId: string, formData: FormData) {
  const { db, user } = await currentUser();
  const { data: row } = await db
    .from('applicant_requirements')
    .select('id, applicant_id')
    .eq('id', applicantRequirementId)
    .single();
  if (!row) throw new Error('Checklist item not found');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file to upload.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('The file is larger than 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new Error('Only PDF, JPG and PNG files are accepted.');

  const admin = supabaseAdmin();
  const path = `${row.applicant_id}/${row.id}/${randomUUID()}`;
  const { error: storageError } = await admin.storage.from('documents').upload(path, bytes, { contentType: mime });
  if (storageError) throw new Error(storageError.message);

  const { error } = await admin.rpc('add_document', {
    p_applicant_requirement_id: row.id,
    p_storage_path: path,
    p_original_name: safeName(file.name),
    p_mime_type: mime,
    p_size_bytes: bytes.length,
    p_sha256: sha256(bytes),
    p_agent: user.id,
  });
  if (error) throw new Error(error.message);
  await audit(user.id, 'document.uploaded_by_agent', row.applicant_id, { item: row.id, name: safeName(file.name) });
  revalidatePath(`/applicants/${row.applicant_id}`);
}

export async function reviewItem(applicantRequirementId: string, applicantId: string, formData: FormData) {
  const { db, user } = await currentUser();
  const decision = formData.get('decision');
  const reason = text(formData, 'reason');
  if (decision !== 'approved' && decision !== 'rejected') throw new Error('Unknown decision');
  if (decision === 'rejected' && !reason) throw new Error('Give a reason when rejecting, so the student knows what to fix.');

  const checked = formData.getAll('point').map(Number);
  if (decision === 'approved') {
    const { data: item } = await db
      .from('applicant_requirements')
      .select('requirement:template_requirements(review_points)')
      .eq('id', applicantRequirementId)
      .single();
    const points = (item as unknown as { requirement: { review_points: unknown[] } } | null)?.requirement.review_points ?? [];
    if (checked.length < points.length) throw new Error('Tick every review point before approving, or reject the document with a reason.');
  }
  const { error } = await db
    .from('applicant_requirements')
    .update({
      status: decision,
      rejection_reason: decision === 'rejected' ? reason : null,
      checked_points: checked,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicantRequirementId)
    .eq('applicant_id', applicantId);
  if (error) throw new Error(error.message);
  await audit(user.id, `document.${decision}`, applicantId, { item: applicantRequirementId, reason });
  revalidatePath(`/applicants/${applicantId}`);
}

export async function markStepDone(applicantRequirementId: string, applicantId: string, done: boolean) {
  const { db, user } = await currentUser();
  const { error } = await db
    .from('applicant_requirements')
    .update({ status: done ? 'approved' : 'missing', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', applicantRequirementId)
    .eq('applicant_id', applicantId);
  if (error) throw new Error(error.message);
  await audit(user.id, done ? 'step.done' : 'step.reopened', applicantId, { item: applicantRequirementId });
  revalidatePath(`/applicants/${applicantId}`);
}

export async function setPhysical(
  applicantRequirementId: string,
  applicantId: string,
  change: { required?: boolean; received?: boolean },
) {
  const { db, user } = await currentUser();
  const patch: Record<string, boolean> = {};
  if (change.required !== undefined) patch.physical_required = change.required;
  if (change.received !== undefined) patch.physical_received = change.received;
  const { error } = await db.from('applicant_requirements').update(patch).eq('id', applicantRequirementId).eq('applicant_id', applicantId);
  if (error) throw new Error(error.message);
  await audit(user.id, 'physical.updated', applicantId, { item: applicantRequirementId, ...patch });
  revalidatePath(`/applicants/${applicantId}`);
  revalidatePath(`/applicants/${applicantId}/vfs`);
}

export async function setStage(applicantId: string, stage: Applicant['stage']) {
  const { db, user } = await currentUser();
  if (stage === 'ready') {
    const rows = await loadApplicantRequirements(db, applicantId);
    const readiness = summarise(
      rows.map((r) => ({
        mandatory: r.requirement.mandatory,
        status: r.status,
        physicalRequired: r.physical_required,
        physicalReceived: r.physical_received,
      })),
    );
    if (!readiness.readyForSubmission) throw new Error('Every mandatory document must be approved first.');
  }
  const { error } = await db.from('applicants').update({ stage }).eq('id', applicantId);
  if (error) throw new Error(error.message);
  await audit(user.id, 'stage.changed', applicantId, { stage });
  revalidatePath(`/applicants/${applicantId}`);
  revalidatePath('/applicants');
}
