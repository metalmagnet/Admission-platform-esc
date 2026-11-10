import type { SupabaseClient } from '@supabase/supabase-js';
import { generateChecklist } from './checklist/engine';
import type { ApplicantFacts, Checklist, Localised, Predicate, RequirementDef, TemplateDef } from './checklist/types';

export type Applicant = {
  id: string;
  template_id: string;
  agent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string | null;
  email: string;
  phone: string | null;
  language: 'en' | 'fr';
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  institution: string | null;
  course_name: string | null;
  mqf_level: number | null;
  course_start: string | null;
  course_months: number | null;
  course_type: 'full_time' | 'part_time' | null;
  funding: 'self' | 'sponsored' | null;
  accommodation: 'school' | 'lease' | 'host' | 'hotel' | null;
  host_secondary_address: boolean;
  vfs_date: string | null;
  vfs_fee_type: 'standard' | 'extended' | null;
  stage: 'collecting' | 'ready' | 'submitted' | 'approved' | 'rejected' | 'action_required';
  notes: string | null;
  created_at: string;
};

export type RequirementRow = {
  id: string;
  code: string;
  kind: 'document' | 'step';
  provider: 'student' | 'agent';
  title: Localised;
  help: Localised;
  mandatory: boolean;
  physical_default: boolean;
  conditions: Predicate[];
  review_points: Localised[];
  sort: number;
};

export type DocumentRow = {
  id: string;
  version: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  uploaded_by_agent: string | null;
  is_current: boolean;
};

export type ApplicantRequirement = {
  id: string;
  applicant_id: string;
  status: 'missing' | 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  physical_required: boolean;
  physical_received: boolean;
  checked_points: number[];
  requirement: RequirementRow;
  documents: DocumentRow[];
};

export const STAGES: Record<Applicant['stage'], string> = {
  collecting: 'Collecting documents',
  ready: 'Ready for submission',
  submitted: 'Submitted',
  approved: 'Visa approved',
  rejected: 'Visa rejected',
  action_required: 'Action required',
};

export const today = () => new Date().toISOString().slice(0, 10);

export function factsFrom(a: Applicant): ApplicantFacts {
  return {
    dateOfBirth: a.date_of_birth,
    passportExpiry: a.passport_expiry,
    courseStart: a.course_start,
    courseMonths: a.course_months,
    mqfLevel: a.mqf_level,
    funding: a.funding,
    accommodation: a.accommodation,
    hostSecondaryAddress: a.host_secondary_address,
    appointmentDate: a.vfs_date,
    appointmentType: a.vfs_fee_type,
  };
}

export async function loadTemplate(db: SupabaseClient, templateId: string): Promise<TemplateDef & { rows: RequirementRow[] }> {
  const [{ data: t, error }, { data: rows, error: rowsError }] = await Promise.all([
    db.from('templates').select('*').eq('id', templateId).single(),
    db.from('template_requirements').select('*').eq('template_id', templateId).order('sort'),
  ]);
  if (error || rowsError || !t || !rows) throw new Error(error?.message ?? rowsError?.message ?? 'Template not found');
  const requirements: RequirementDef[] = (rows as RequirementRow[]).map((r) => ({
    code: r.code,
    sort: r.sort,
    kind: r.kind,
    provider: r.provider,
    title: r.title,
    help: r.help,
    mandatory: r.mandatory,
    physicalDefault: r.physical_default,
    when: r.conditions,
    reviewPoints: r.review_points,
    pdfRef: '',
  }));
  return {
    country: t.country,
    visaType: t.visa_type,
    version: t.version,
    issuedOn: t.issued_on,
    source: t.source,
    generalNotes: t.general_notes,
    requirements,
    rows: rows as RequirementRow[],
  };
}

// Adds rows for newly required items and drops untouched rows that no longer apply.
// A row that already has a document is kept so nothing the student uploaded disappears.
export async function syncChecklist(db: SupabaseClient, applicant: Applicant): Promise<Checklist> {
  const template = await loadTemplate(db, applicant.template_id);
  const checklist = generateChecklist(template, factsFrom(applicant), today());
  const needed = new Set(checklist.items.map((i) => i.code));

  const { data: existing, error } = await db
    .from('applicant_requirements')
    .select('id, status, requirement_id')
    .eq('applicant_id', applicant.id);
  if (error) throw new Error(error.message);

  const byId = new Map(template.rows.map((r) => [r.id, r]));
  const haveCodes = new Set((existing ?? []).map((e) => byId.get(e.requirement_id)?.code));

  const toAdd = template.rows
    .filter((r) => needed.has(r.code) && !haveCodes.has(r.code))
    .map((r) => ({ applicant_id: applicant.id, requirement_id: r.id, physical_required: r.physical_default }));
  if (toAdd.length > 0) {
    const { error: insertError } = await db.from('applicant_requirements').insert(toAdd);
    if (insertError) throw new Error(insertError.message);
  }

  const stale = (existing ?? [])
    .filter((e) => e.status === 'missing' && !needed.has(byId.get(e.requirement_id)?.code ?? ''))
    .map((e) => e.id);
  if (stale.length > 0) {
    const { error: deleteError } = await db.from('applicant_requirements').delete().in('id', stale);
    if (deleteError) throw new Error(deleteError.message);
  }

  return checklist;
}

export async function loadApplicantRequirements(db: SupabaseClient, applicantId: string) {
  const { data, error } = await db
    .from('applicant_requirements')
    .select('*, requirement:template_requirements(*), documents(*)')
    .eq('applicant_id', applicantId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ApplicantRequirement[])
    .map((r) => ({ ...r, documents: [...r.documents].sort((a, b) => b.version - a.version) }))
    .sort((a, b) => a.requirement.sort - b.requirement.sort);
}

export function fullName(a: Pick<Applicant, 'first_name' | 'last_name'>) {
  return `${a.first_name} ${a.last_name}`;
}
