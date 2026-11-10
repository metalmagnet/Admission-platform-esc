'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createApplicant } from '@/app/actions';
import { ApplicantFields } from '../ApplicantFields';

export function NewApplicantForm() {
  const [state, action, pending] = useActionState(createApplicant, { error: null as string | null, duplicates: [] as { id: string; name: string; reason: string }[] });

  return (
    <form action={action} className="stack">
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.duplicates.length > 0 && (
        <div className="notice blocker" role="alert">
          <p>This looks like someone who is already in the system:</p>
          <ul>
            {state.duplicates.map((d) => (
              <li key={d.id}><Link href={`/applicants/${d.id}`} target="_blank">{d.name}</Link> ({d.reason})</li>
            ))}
          </ul>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" name="confirm_duplicate" value="yes" />
            <span>This is a different person. Create the profile anyway.</span>
          </label>
        </div>
      )}
      <ApplicantFields />
      <div><button className="btn primary" disabled={pending}>{pending ? 'Creating' : 'Create applicant and generate checklist'}</button></div>
    </form>
  );
}
