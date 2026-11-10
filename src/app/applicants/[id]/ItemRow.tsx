import { agentUpload, markStepDone, reviewItem, setPhysical } from '@/app/actions';
import type { ApplicantRequirement } from '@/lib/data';

const STATUS_LABEL = { missing: 'Missing', pending: 'To review', approved: 'Approved', rejected: 'Rejected' } as const;
const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

type Props = {
  row: ApplicantRequirement;
  applicantId: string;
  actors: Map<string, string>;
  duplicateNotes: string[];
  feeText?: string;
  obsolete?: boolean;
};

export function ItemRow({ row, applicantId, actors, duplicateNotes, feeText, obsolete }: Props) {
  const req = row.requirement;
  const current = row.documents.find((d) => d.is_current);
  const older = row.documents.filter((d) => !d.is_current);
  const isStep = req.kind === 'step';

  return (
    <li className={`item${obsolete ? ' obsolete' : ''}`}>
      <div className="item-head">
        <span className="mono muted">{req.code}</span>
        <h3>{req.title.en}</h3>
        <span className={`chip ${row.status}`}>{STATUS_LABEL[row.status]}</span>
        {!req.mandatory && <span className="chip plain">Optional</span>}
        {req.provider === 'agent' && <span className="chip plain">Done by agent</span>}
      </div>

      {req.help.en && <p className="muted small">{req.help.en}</p>}
      {isStep && feeText && <p className="small">{feeText}</p>}
      {obsolete && <p className="small">No longer required with the current details, but it has a file or a decision on it, so it is kept.</p>}

      {row.status === 'rejected' && row.rejection_reason && (
        <p className="notice blocker small">Rejected: {row.rejection_reason}</p>
      )}

      {current && (
        <div className="row small">
          <strong>{current.original_name}</strong>
          <span className="muted">
            version {current.version}, {kb(current.size_bytes)}, uploaded {when(current.uploaded_at)} by{' '}
            {current.uploaded_by_agent ? (actors.get(current.uploaded_by_agent) ?? 'an agent') : 'the student'}
          </span>
          <a href={`/api/documents/${current.id}`} target="_blank" rel="noreferrer">Preview</a>
          <a href={`/api/documents/${current.id}?download=1`}>Download</a>
        </div>
      )}
      {duplicateNotes.map((n) => (
        <p key={n} className="notice warning small">{n}</p>
      ))}

      {row.status === 'pending' && current && (
        <form action={reviewItem.bind(null, row.id, applicantId)} className="stack">
          {req.review_points.length > 0 && (
            <ul className="points">
              {req.review_points.map((p, i) => (
                <li key={p.en}>
                  <label className="check">
                    <input type="checkbox" name="point" value={i} defaultChecked={row.checked_points.includes(i)} />
                    <span>{p.en}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="reject-form">
            <button name="decision" value="approved" className="btn small primary">Approve</button>
            <input name="reason" placeholder="Reason, if rejecting" aria-label="Reason for rejecting" />
            <button name="decision" value="rejected" className="btn small">Reject</button>
          </div>
        </form>
      )}

      {row.status === 'approved' && !isStep && current && (
        <form action={reviewItem.bind(null, row.id, applicantId)} className="reject-form">
          <input name="reason" placeholder="Reason, to reopen as rejected" aria-label="Reason for rejecting" />
          <button name="decision" value="rejected" className="btn small quiet">Reject after all</button>
        </form>
      )}

      {isStep && (
        <form action={markStepDone.bind(null, row.id, applicantId, row.status !== 'approved')}>
          <button className="btn small">{row.status === 'approved' ? 'Mark as not paid' : 'Mark as paid'}</button>
        </form>
      )}

      {!isStep && (
        <div className="row">
          <form action={setPhysical.bind(null, row.id, applicantId, { required: !row.physical_required })}>
            <button className="btn small quiet">{row.physical_required ? 'No physical copy needed' : 'Needs a physical copy'}</button>
          </form>
          {row.physical_required && (
            <form action={setPhysical.bind(null, row.id, applicantId, { received: !row.physical_received })}>
              <button className="btn small quiet">{row.physical_received ? 'Physical copy received (undo)' : 'Mark physical copy received'}</button>
            </form>
          )}
          {row.physical_required && (
            <span className={`chip ${row.physical_received ? 'approved' : 'missing'}`}>
              {row.physical_received ? 'Physical in office' : 'Physical outstanding'}
            </span>
          )}
        </div>
      )}

      {!isStep && (
        <details open={!current && req.provider === 'agent'}>
          <summary className="small">{current ? 'Upload a replacement for the student' : 'Upload a file for the student'}</summary>
          <form action={agentUpload.bind(null, row.id)} className="reject-form" style={{ marginTop: 8 }}>
            <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required />
            <button className="btn small">Upload</button>
          </form>
        </details>
      )}

      {older.length > 0 && (
        <details>
          <summary className="small">Earlier versions ({older.length})</summary>
          <ul className="history">
            {older.map((d) => (
              <li key={d.id}>
                Version {d.version}: {d.original_name}, {when(d.uploaded_at)}{' '}
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">Preview</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
