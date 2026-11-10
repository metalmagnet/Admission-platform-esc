import Link from 'next/link';
import { addDays } from '@/lib/checklist/dates';
import { summarise } from '@/lib/checklist/engine';
import { STAGES, fullName, today, type Applicant } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';

type Row = Applicant & {
  applicant_requirements: {
    status: 'missing' | 'pending' | 'approved' | 'rejected';
    physical_required: boolean;
    physical_received: boolean;
    requirement: { mandatory: boolean };
  }[];
};

export default async function Applicants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; agent?: string; view?: string }>;
}) {
  const { q = '', stage = '', agent = '', view = '' } = await searchParams;
  const db = await supabaseServer();
  const { data: me } = await db.auth.getUser();
  const [{ data: rows }, { data: profiles }] = await Promise.all([
    db
      .from('applicants')
      .select('*, applicant_requirements(status, physical_required, physical_received, requirement:template_requirements(mandatory))')
      .order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name, role'),
  ]);

  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const isAdmin = (profiles ?? []).find((p) => p.id === me.user?.id)?.role === 'admin';
  const now = today();

  const enriched = ((rows ?? []) as unknown as Row[]).map((a) => {
    const readiness = summarise(
      a.applicant_requirements.map((r) => ({
        mandatory: r.requirement.mandatory,
        status: r.status,
        physicalRequired: r.physical_required,
        physicalReceived: r.physical_received,
      })),
    );
    const vfsLatest = a.course_start ? addDays(a.course_start, -63) : null;
    const deadline = a.vfs_date ?? vfsLatest;
    const overdue = !a.vfs_date && vfsLatest !== null && vfsLatest < now && ['collecting', 'ready'].includes(a.stage);
    return { a, readiness, deadline, overdue };
  });

  const open = enriched.filter((e) => ['collecting', 'ready', 'action_required'].includes(e.a.stage));
  const tally = [
    ['Active applicants', open.length + enriched.filter((e) => e.a.stage === 'submitted').length, ''],
    ['Awaiting documents', open.filter((e) => e.readiness.missing + e.readiness.rejected > 0).length, 'missing'],
    ['Documents to review', enriched.reduce((n, e) => n + e.readiness.pending, 0), 'review'],
    ['Ready for submission', enriched.filter((e) => e.a.stage === 'ready').length, ''],
    ['Submitted', enriched.filter((e) => e.a.stage === 'submitted').length, ''],
    ['Approved / rejected', `${enriched.filter((e) => e.a.stage === 'approved').length} / ${enriched.filter((e) => e.a.stage === 'rejected').length}`, ''],
    ['Past VFS deadline', enriched.filter((e) => e.overdue).length, 'alert'],
  ] as const;

  const needle = q.toLowerCase();
  const shown = enriched
    .filter(({ a, readiness, overdue }) => {
      if (needle && !`${a.first_name} ${a.last_name} ${a.email} ${a.institution ?? ''}`.toLowerCase().includes(needle)) return false;
      if (stage && a.stage !== stage) return false;
      if (agent && a.agent_id !== agent) return false;
      if (view === 'missing' && readiness.missing + readiness.rejected === 0) return false;
      if (view === 'review' && readiness.pending === 0) return false;
      if (view === 'overdue' && !overdue) return false;
      return true;
    })
    .sort((x, y) => (x.deadline ?? '9999').localeCompare(y.deadline ?? '9999'));

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <h1>Applicants</h1>
          <p>{isAdmin ? 'Everyone on the team, soonest deadline first.' : 'Your applicants, soonest deadline first.'}</p>
        </div>
        <Link className="btn primary" href="/applicants/new">New applicant</Link>
      </div>

      <div className="tally">
        {tally.map(([label, value, view]) => (
          <div key={label} className={view === 'alert' ? 'alert' : undefined}>
            <strong>{value}</strong>
            <span className="label">{label}</span>
          </div>
        ))}
      </div>

      <form className="grid-3" style={{ padding: '24px 0' }}>
        <label className="field">
          <span>Search</span>
          <input name="q" defaultValue={q} placeholder="Name, email or institution" />
        </label>
        <label className="field">
          <span>Stage</span>
          <select name="stage" defaultValue={stage}>
            <option value="">All stages</option>
            {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Show</span>
          <select name="view" defaultValue={view}>
            <option value="">Everything</option>
            <option value="missing">Missing or rejected documents</option>
            <option value="review">Documents to review</option>
            <option value="overdue">Past VFS deadline</option>
          </select>
        </label>
        {isAdmin && (
          <label className="field">
            <span>Agent</span>
            <select name="agent" defaultValue={agent}>
              <option value="">All agents</option>
              {(profiles ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </label>
        )}
        <div style={{ alignSelf: 'end' }}><button className="btn">Apply</button></div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Course</th>
              <th>Stage</th>
              <th>Documents</th>
              <th>VFS</th>
              {isAdmin && <th>Agent</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ a, readiness, deadline, overdue }) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/applicants/${a.id}`}><strong>{fullName(a)}</strong></Link>
                  <div className="muted small">{a.email}</div>
                </td>
                <td>
                  {a.institution ?? <span className="muted">Not set</span>}
                  <div className="muted small">{a.course_start ? `Starts ${a.course_start}` : ''}</div>
                </td>
                <td>{STAGES[a.stage]}</td>
                <td>
                  {readiness.approved} of {readiness.total} approved
                  <div className="small">
                    {readiness.pending > 0 && <span className="chip pending">{readiness.pending} to review</span>}{' '}
                    {readiness.rejected > 0 && <span className="chip rejected">{readiness.rejected} rejected</span>}
                  </div>
                </td>
                <td>
                  {deadline ?? <span className="muted">No date</span>}
                  <div className="small muted">{a.vfs_date ? 'Booked' : deadline ? 'Latest booking date' : ''}</div>
                  {overdue && <span className="chip rejected">Past deadline</span>}
                </td>
                {isAdmin && <td>{names.get(a.agent_id)}</td>}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="muted">
                  {enriched.length === 0 ? 'No applicants yet. Create the first one.' : 'Nothing matches these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
