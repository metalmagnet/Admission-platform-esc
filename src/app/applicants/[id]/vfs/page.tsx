import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setPhysical } from '@/app/actions';
import { generateChecklist, summarise } from '@/lib/checklist/engine';
import { factsFrom, fullName, loadApplicantRequirements, loadTemplate, today, type Applicant } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';

export default async function VfsBundle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data: applicant } = await db.from('applicants').select('*').eq('id', id).single<Applicant>();
  if (!applicant) notFound();

  const [rows, template] = await Promise.all([loadApplicantRequirements(db, id), loadTemplate(db, applicant.template_id)]);
  const checklist = generateChecklist(template, factsFrom(applicant), today());
  const needed = new Set(checklist.items.map((i) => i.code));
  const live = rows.filter((r) => needed.has(r.requirement.code) && r.requirement.kind === 'document');

  const physical = live.filter((r) => r.physical_required);
  const digitalOnly = live.filter((r) => !r.physical_required);
  const notApproved = live.filter((r) => r.requirement.mandatory && r.status !== 'approved');
  const readiness = summarise(
    live.map((r) => ({
      mandatory: r.requirement.mandatory,
      status: r.status,
      physicalRequired: r.physical_required,
      physicalReceived: r.physical_received,
    })),
  );

  return (
    <main className="shell" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <p className="label"><Link href={`/applicants/${id}`}>{fullName(applicant)}</Link> / VFS bundle</p>
          <h1 style={{ marginTop: 8 }}>Take to VFS</h1>
          <p>
            {applicant.vfs_date ? `Appointment on ${applicant.vfs_date}` : 'No appointment booked yet'}
            {applicant.vfs_fee_type ? `, ${applicant.vfs_fee_type}` : ''}.
            {checklist.fee.amount !== null
              ? ` Fee to pay by card: €${checklist.fee.amount}.`
              : ` Fee to pay by card: €${checklist.fee.standard} standard or €${checklist.fee.extended} extended.`}
          </p>
        </div>
        <span className={`chip ${readiness.readyForVfs ? 'approved' : 'missing'}`}>
          {readiness.readyForVfs ? 'Complete' : 'Not complete'}
        </span>
      </div>

      {notApproved.length > 0 && (
        <div className="notices">
          {notApproved.map((r) => (
            <p key={r.id} className="notice blocker">{r.requirement.title.en} is {r.status === 'missing' ? 'still missing' : r.status === 'pending' ? 'waiting for review' : 'rejected'}.</p>
          ))}
        </div>
      )}

      <h2>Physical documents ({physical.filter((r) => r.physical_received).length} of {physical.length} in the office)</h2>
      <ul className="bundle items" style={{ marginTop: 12 }}>
        {physical.map((r) => (
          <li key={r.id}>
            <span className={`box${r.physical_received ? ' on' : ''}`} aria-hidden />
            <span style={{ flex: 1 }}>
              {r.requirement.title.en}
              <span className="muted small"> ({r.physical_received ? 'in the office' : 'not received'}, digital copy {r.status === 'approved' ? 'approved' : r.status === 'missing' ? 'missing' : r.status === 'pending' ? 'waiting for review' : 'rejected'})</span>
            </span>
            <form action={setPhysical.bind(null, r.id, id, { received: !r.physical_received })}>
              <button className="btn small quiet">{r.physical_received ? 'Undo' : 'Mark received'}</button>
            </form>
          </li>
        ))}
        {physical.length === 0 && <li className="muted">No physical documents are flagged.</li>}
      </ul>

      <h2 style={{ marginTop: 40 }}>Digital only</h2>
      <ul className="bundle items" style={{ marginTop: 12 }}>
        {digitalOnly.map((r) => (
          <li key={r.id}>
            <span className={`box${r.status === 'approved' ? ' on' : ''}`} aria-hidden />
            <span style={{ flex: 1 }}>{r.requirement.title.en}</span>
            <span className={`chip ${r.status}`}>{r.status === 'pending' ? 'To review' : r.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
