// Prints SQL that loads the Malta template. Run: npx tsx scripts/seed-sql.ts > supabase/seed-malta.sql
import { maltaStudentNational as t } from '../src/lib/checklist/malta';

const q = (v: unknown) => `'${String(v).replace(/'/g, "''")}'`;
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const out: string[] = [];
out.push('-- Malta student national visa template, generated from src/lib/checklist/malta.ts');
out.push('-- Safe to re-run: upserts on (country, visa_type, version) and (template_id, code).');
out.push(`insert into templates (country, visa_type, version, issued_on, source, general_notes) values (${q(t.country)}, ${q(t.visaType)}, ${q(t.version)}, ${q(t.issuedOn)}, ${q(t.source)}, ${j(t.generalNotes)})
on conflict (country, visa_type, version) do update set issued_on = excluded.issued_on, source = excluded.source, general_notes = excluded.general_notes;`);
const rows = t.requirements.map((r) =>
  `((select id from templates where country=${q(t.country)} and visa_type=${q(t.visaType)} and version=${q(t.version)}), ${q(r.code)}, ${r.sort}, ${q(r.kind)}, ${q(r.provider)}, ${j(r.title)}, ${j(r.help)}, ${r.mandatory}, ${r.physicalDefault}, ${j(r.when)}, ${j(r.reviewPoints)}, ${q(r.pdfRef)})`);
out.push(`insert into template_requirements (template_id, code, sort, kind, provider, title, help, mandatory, physical_default, conditions, review_points, pdf_ref) values\n${rows.join(',\n')}
on conflict (template_id, code) do update set sort=excluded.sort, kind=excluded.kind, provider=excluded.provider, title=excluded.title, help=excluded.help, mandatory=excluded.mandatory, physical_default=excluded.physical_default, conditions=excluded.conditions, review_points=excluded.review_points, pdf_ref=excluded.pdf_ref;`);
console.log(out.join('\n\n'));
