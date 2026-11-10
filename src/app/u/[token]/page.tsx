import Link from 'next/link';
import { text, type Lang } from '@/lib/portal-text';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateChecklist } from '@/lib/checklist/engine';
import { factsFrom, loadApplicantRequirements, loadTemplate, today, type Applicant } from '@/lib/data';
import { resolveLink, studentUpload } from './actions';

const MESSAGES: Record<string, 'sent' | 'errBig' | 'errType' | 'errEmpty' | 'errItem' | 'errGeneric'> = {
  ok: 'sent',
  big: 'errBig',
  type: 'errType',
  empty: 'errEmpty',
  item: 'errItem',
  generic: 'errGeneric',
};

export default async function Portal({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string; r?: string }>;
}) {
  const { token } = await params;
  const { lang: langParam, r } = await searchParams;
  const link = await resolveLink(token);

  if (!link) {
    const t = text[langParam === 'fr' ? 'fr' : 'en'];
    return (
      <main className="portal">
        <h1>{t.invalidTitle}</h1>
        <p className="muted" style={{ marginTop: 12 }}>{t.invalidBody}</p>
      </main>
    );
  }

  const admin = supabaseAdmin();
  const { data: applicant } = await admin.from('applicants').select('*').eq('id', link.applicant_id).single<Applicant>();
  if (!applicant) return null;

  const lang: Lang = langParam === 'fr' || langParam === 'en' ? langParam : applicant.language;
  const t = text[lang];
  const [rows, template] = await Promise.all([loadApplicantRequirements(admin, applicant.id), loadTemplate(admin, applicant.template_id)]);
  const needed = new Set(generateChecklist(template, factsFrom(applicant), today()).items.map((i) => i.code));
  const items = rows.filter((x) => needed.has(x.requirement.code) && x.requirement.provider === 'student' && x.requirement.kind === 'document');

  const mandatory = items.filter((x) => x.requirement.mandatory);
  const done = mandatory.filter((x) => x.status === 'approved').length;
  const allUploaded = mandatory.every((x) => x.status !== 'missing' && x.status !== 'rejected');
  const message = r ? MESSAGES[r] : undefined;

  return (
    <main className="portal">
      <div className="portal-head">
        <span className="brand">Admissions and visas</span>
        <nav className="lang" aria-label={t.language}>
          <Link href={`?lang=en`} aria-current={lang === 'en'}>English</Link>
          <Link href={`?lang=fr`} aria-current={lang === 'fr'}>Français</Link>
        </nav>
      </div>

      <h1>{t.hello(applicant.first_name)}</h1>
      <p className="muted" style={{ marginTop: 12 }}>{t.intro}</p>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={mandatory.length} aria-valuenow={done}>
        <i style={{ width: `${mandatory.length ? (done / mandatory.length) * 100 : 0}%` }} />
      </div>
      <p className="small muted" style={{ marginTop: -16, marginBottom: 24 }}>{t.progress(done, mandatory.length)}</p>

      {message && (
        <p className={message === 'sent' ? 'notice' : 'error'} role="status" style={{ marginBottom: 24 }}>{t[message]}</p>
      )}
      {allUploaded && mandatory.length > 0 && <p className="notice" style={{ marginBottom: 24 }}>{t.allDone}</p>}

      {template.generalNotes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <span className="label">{t.notes}</span>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {template.generalNotes.map((n) => <li key={n.en}>{n[lang]}</li>)}
          </ul>
        </section>
      )}

      <ul className="items">
        {items.map((x) => {
          const current = x.documents.find((d) => d.is_current);
          const locked = x.status === 'approved';
          return (
            <li key={x.id} id={x.id} className="item">
              <div className="item-head">
                <h3>{x.requirement.title[lang]}</h3>
                <span className={`chip ${x.status}`}>{t[x.status]}</span>
              </div>
              {x.requirement.help[lang] && <p className="muted small">{x.requirement.help[lang]}</p>}
              {!x.requirement.mandatory && <p className="small muted">{t.optional}</p>}
              {x.status === 'rejected' && x.rejection_reason && (
                <p className="notice blocker small"><strong>{t.reason}:</strong> {x.rejection_reason}</p>
              )}
              {current && (
                <p className="small muted">{current.original_name}, {t.uploadedOn} {current.uploaded_at.slice(0, 10)}</p>
              )}
              {!locked && (
                <form action={studentUpload.bind(null, token, x.id, lang)} className="reject-form">
                  <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required aria-label={t.choose} />
                  <button className="btn small">{current ? t.replace : t.upload}</button>
                </form>
              )}
              {!locked && <p className="small muted">{t.formats}</p>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
