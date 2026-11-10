import { NewApplicantForm } from './NewApplicantForm';

export default function NewApplicant() {
  return (
    <main className="shell" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <h1>New applicant</h1>
          <p>Only the name, date of birth and email are needed to start. Anything you leave blank is flagged on the checklist, and the matching items appear once you fill it in.</p>
        </div>
      </div>
      <NewApplicantForm />
    </main>
  );
}
