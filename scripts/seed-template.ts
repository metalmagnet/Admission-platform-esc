import { createClient } from '@supabase/supabase-js';
import { maltaStudentNational as t } from '../src/lib/checklist/malta';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: template, error } = await db
  .from('templates')
  .upsert(
    {
      country: t.country,
      visa_type: t.visaType,
      version: t.version,
      issued_on: t.issuedOn,
      source: t.source,
      general_notes: t.generalNotes,
    },
    { onConflict: 'country,visa_type,version' },
  )
  .select('id')
  .single();
if (error) throw error;

const rows = t.requirements.map((r) => ({
  template_id: template.id,
  code: r.code,
  sort: r.sort,
  kind: r.kind,
  provider: r.provider,
  title: r.title,
  help: r.help,
  mandatory: r.mandatory,
  physical_default: r.physicalDefault,
  conditions: r.when,
  review_points: r.reviewPoints,
  pdf_ref: r.pdfRef,
}));

const { error: reqError } = await db.from('template_requirements').upsert(rows, { onConflict: 'template_id,code' });
if (reqError) throw reqError;

console.log(`Template ${t.country} ${t.visaType} v${t.version}: ${rows.length} requirements`);
