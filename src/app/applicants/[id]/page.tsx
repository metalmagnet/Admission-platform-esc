import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setStage, updateApplicant } from '@/app/actions';
import { generateChecklist, summarise } from '@/lib/checklist/engine';
import {
  STAGES,
  factsFrom,
  fullName,
  loadApplicantRequirements,
  loadTemplate,
  today,
  type Applicant,
} from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { ApplicantFields } from '../ApplicantFields';
import { ItemRow } from './ItemRow';
import { UploadLink } from './UploadLink';

type DuplicateHit = {
  id: string;
  sha256: string;
  applicant_requirement: {
    id: string;
    applicant_id: string;
    requirement: { code: string };
    applicant: { first_name: string; last_name: string; agent_id: string };
  };
};

export default async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data: auth } = await db.auth.getUser();
  const { data: applicant } = await db.from('applicants').select('*').eq('id', id).single<Applicant>();
  if (!applicant) notFound();

  const [rows, template, { data: profiles }, { data: links }, { data: activity }] = await Promise.all([
    loadApplicantRequirements(db, id),
    loadTemplate(db, applicant.template_id),
    db.from('profiles').select('id, full_name, role'),
    db.from('upload_links').select('expires_at, revoked_at').eq('applicant_id', id),
    db.from('audit_log').select('at, actor, action, details').eq('applicant_id', id).order('at', { ascending: false }).limit(12),
  ]);

  const checklist = generateChecklist(template, factsFrom(applicant), today());
  const needed = new Set(checklist.items.map((i) => i.code));
  const actors = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const isAdmin = (profiles ?? []).find((p) => p.id === auth.user?.id)?.role === 'admin';

  const live = rows.filter((r) => needed.has(r.requirement.code));
  const obsolete = rows.filter((r) => !needed.has(r.requirement.code));
  const readiness = summarise(
    live.map((r) => ({
      mandatory: r.requirement.mandatory,
      status: r.status,
      physicalRequired: r.physical_required,
      physicalReceived: r.physical_received,
    })),
  );

  const hashes = rows.flatMap((r) => r.documents.filter((d) => d.is_current).map((d) => d.sha256));
  const hits: DuplicateHit[] = hashes.length
    ? (((
        await supabaseAdmin()
          .from('documents')
          .select('id, sha256, applicant_requirement:applicant_requirements(id, applicant_id, requirement:template_requirements(code), applicant:applicants(first_name, last_name, agent_id))')
          .in('sha256', hashes)
          .eq('is_current', true)
      ).data ?? []) as unknown as DuplicateHit[])
    : [];

  const duplicateNotes = (docId: string, sha: string) =>
    hits
      .filter((h) => h.sha256 === sha && h.id !== docId)
      .map((h) => {
        const link = h.applicant_requirement;
        if (link.applicant_id === id) return `The same file is also attached to item ${link.requirement.code} on this profile.`;
        const mayName = isAdmin || link.applicant.agent_id === auth.user?.id;
        return mayName
          ? `The same file is attached to ${link.applicant.first_name} ${link.applicant.last_name}. Check it was not mixed up.`
          : 'The same file is attached to another applicant’s profile. Check it was not mixed up.';
      });

  const wage = Number(process.env.NATIONAL_MIN_WAGE_EUR_MONTHLY);
  const fundsText =
    wage > 0 && applicant.course_months
      ? `At least €${(0.75 * wage * applicant.course_months).toFixed(0)} (75% of €${wage} for ${applicant.course_months} months)`
      : 'Not shown. Set NATIONAL_MIN_WAGE_EUR_MONTHLY and the course length.';
  const feeText = `Standard €${checklist.fee.standard}, extended €${checklist.fee.extended} at age ${checklist.fee.ageYears}.${
    checklist.fee.amount !== null ? ` Booked as ${applicant.vfs_fee_type}: €${checklist.fee.amount}.` : ''
  }`;

  const now = Date.now();
  const hasActiveLink = (links ?? []).some((l) => !l.revoked_at && new Date(l.expires_at).getTime() > now);
  const d = checklist.deadlines;

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="label"><Link href="/applicants">Applicants</Link> / {actors.get(applicant.agent_id)}</p>
          <h1 style={{ marginTop: 8 }}>{fullName(applicant)}</h1>
          <p>{applicant.email}{applicant.phone ? `, ${applicant.phone}` : ''}</p>
        </div>
        <span className="chip pending">{STAGES[applicant.stage]}</span>
      </div>

      <div className="workspace">
        <div>
          {(checklist.warnings.length > 0 || checklist.unresolved.length > 0) && (
            <div className="notices">
              {checklist.warnings.map((w) => (
                <p key={w.code} className={`notice ${w.severity}`}>{w.message}</p>
              ))}
            </div>
          )}

          <h2>Checklist</h2>
          <p className="muted small" style={{ margin: '8px 0 16px' }}>
            {template.source}. {readiness.approved} of {readiness.total} items approved
            {readiness.pending > 0 ? `, ${readiness.pending} waiting for you` : ''}.
          </p>
          <ul className="items">
            {live.map((r) => (
              <ItemRow
                key={r.id}
                row={r}
                applicantId={id}
                actors={actors}
                feeText={r.requirement.kind === 'step' ? feeText : undefined}
                duplicateNotes={r.documents.filter((x) => x.is_current).flatMap((x) => duplicateNotes(x.id, x.sha256))}
              />
            ))}
          </ul>

          {obsolete.length > 0 && (
            <>
              <h2 style={{ marginTop: 32 }}>Kept from earlier details</h2>
              <ul className="items">
                {obsolete.map((r) => (
                  <ItemRow key={r.id} row={r} applicantId={id} actors={actors} duplicateNotes={[]} obsolete />
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="side">
          <section>
            <span className="label">Next step</span>
            {applicant.stage === 'collecting' && (
              <form action={setStage.bind(null, id, 'ready')}>
                <button className="btn primary" disabled={!readiness.readyForSubmission}>Mark ready for submission</button>
              </form>
            )}
            {applicant.stage === 'ready' && (
              <>
                <Link className="btn primary" href={`/applicants/${id}/vfs`}>Open the VFS bundle</Link>
                <form action={setStage.bind(null, id, 'submitted')}><button className="btn" disabled={!readiness.readyForVfs}>Record as submitted</button></form>
              </>
            )}
            {applicant.stage === 'submitted' && (
              <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <form action={setStage.bind(null, id, 'approved')}><button className="btn small">Visa approved</button></form>
                <form action={setStage.bind(null, id, 'rejected')}><button className="btn small">Visa rejected</button></form>
                <form action={setStage.bind(null, id, 'action_required')}><button className="btn small">Action required</button></form>
              </div>
            )}
            {applicant.stage === 'action_required' && (
              <form action={setStage.bind(null, id, 'collecting')}><button className="btn">Back to collecting</button></form>
            )}
            {applicant.stage === 'collecting' && !readiness.readyForSubmission && (
              <p className="small muted">Every mandatory item has to be approved first.</p>
            )}
            <Link className="small" href={`/applicants/${id}/vfs`}>VFS bundle</Link>
          </section>

          <section>
            <span className="label">Student upload link</span>
            <UploadLink applicantId={id} hasActive={hasActiveLink} />
          </section>

          <section>
            <span className="label">Dates</span>
            <dl>
              <dt>Course starts</dt><dd>{applicant.course_start ?? 'Not set'}</dd>
              <dt>Book VFS by</dt><dd>{d.vfsLatestDate ?? 'Needs course start'}</dd>
              <dt>VFS booked</dt><dd>{applicant.vfs_date ?? 'Not yet'}</dd>
              <dt>Arrive from</dt><dd>{d.earliestEntryDate ?? 'Needs course start'}</dd>
              <dt>Passport until</dt><dd>{applicant.passport_expiry ?? 'Not set'}{d.passportValidUntil ? ` (needs ${d.passportValidUntil})` : ''}</dd>
            </dl>
          </section>

          <section>
            <span className="label">Money</span>
            <dl>
              <dt>Funds</dt><dd>{fundsText}</dd>
              <dt>Visa fee</dt><dd>{feeText}</dd>
            </dl>
          </section>

          <section>
            <details>
              <summary>Edit details and appointment</summary>
              <form action={updateApplicant.bind(null, id)} className="stack" style={{ marginTop: 16 }}>
                <ApplicantFields values={applicant} withAppointment />
                <div><button className="btn primary">Save and update the checklist</button></div>
              </form>
            </details>
          </section>

          <section>
            <span className="label">Recent activity</span>
            <ul className="history" style={{ margin: 0, paddingLeft: 18 }}>
              {(activity ?? []).map((a) => (
                <li key={`${a.at}${a.action}`}>
                  {a.at.slice(0, 16).replace('T', ' ')}, {actors.get(a.actor) ?? 'student'}: {a.action}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
