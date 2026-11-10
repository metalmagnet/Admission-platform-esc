import type { Applicant } from '@/lib/data';

type Props = { values?: Partial<Applicant>; withAppointment?: boolean };

export function ApplicantFields({ values: v = {}, withAppointment = false }: Props) {
  return (
    <>
      <fieldset>
        <legend className="label">Student</legend>
        <div className="grid-2">
          <label className="field"><span>First name</span><input name="first_name" defaultValue={v.first_name} required /></label>
          <label className="field"><span>Last name</span><input name="last_name" defaultValue={v.last_name} required /></label>
          <label className="field"><span>Date of birth</span><input name="date_of_birth" type="date" defaultValue={v.date_of_birth} required /></label>
          <label className="field"><span>Nationality</span><input name="nationality" defaultValue={v.nationality ?? ''} /></label>
          <label className="field"><span>Email</span><input name="email" type="email" defaultValue={v.email} required /></label>
          <label className="field"><span>Phone</span><input name="phone" defaultValue={v.phone ?? ''} /></label>
          <label className="field">
            <span>Language for the upload portal and emails</span>
            <select name="language" defaultValue={v.language ?? 'en'}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Parents or guardian (required if under 18)</legend>
        <div className="grid-3">
          <label className="field"><span>Name</span><input name="parent_name" defaultValue={v.parent_name ?? ''} /></label>
          <label className="field"><span>Email</span><input name="parent_email" type="email" defaultValue={v.parent_email ?? ''} /></label>
          <label className="field"><span>Phone</span><input name="parent_phone" defaultValue={v.parent_phone ?? ''} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Passport</legend>
        <div className="grid-2">
          <label className="field"><span>Passport number</span><input name="passport_number" defaultValue={v.passport_number ?? ''} /></label>
          <label className="field"><span>Passport expiry</span><input name="passport_expiry" type="date" defaultValue={v.passport_expiry ?? ''} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Course</legend>
        <div className="grid-2">
          <label className="field"><span>Institution</span><input name="institution" defaultValue={v.institution ?? ''} /></label>
          <label className="field"><span>Course name</span><input name="course_name" defaultValue={v.course_name ?? ''} /></label>
          <label className="field"><span>MQF level (1 to 8)</span><input name="mqf_level" type="number" min={1} max={8} defaultValue={v.mqf_level ?? ''} /></label>
          <label className="field"><span>Course start</span><input name="course_start" type="date" defaultValue={v.course_start ?? ''} /></label>
          <label className="field"><span>Course length in months</span><input name="course_months" type="number" min={1} defaultValue={v.course_months ?? ''} /></label>
          <label className="field">
            <span>Study type</span>
            <select name="course_type" defaultValue={v.course_type ?? ''}>
              <option value="">Not set</option>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Funding and accommodation</legend>
        <div className="grid-2">
          <label className="field">
            <span>Who pays for the stay</span>
            <select name="funding" defaultValue={v.funding ?? ''}>
              <option value="">Not set yet</option>
              <option value="self">The student</option>
              <option value="sponsored">A sponsor</option>
            </select>
          </label>
          <label className="field">
            <span>Accommodation for the first 14 nights</span>
            <select name="accommodation" defaultValue={v.accommodation ?? ''}>
              <option value="">Not decided yet</option>
              <option value="school">Provided by the school</option>
              <option value="lease">Rented, with a lease</option>
              <option value="host">Free, with a host</option>
              <option value="hotel">Hotel or short-term rental</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" name="host_secondary_address" defaultChecked={v.host_secondary_address} />
          <span>The host’s home is a secondary address (not where the host normally lives)</span>
        </label>
      </fieldset>

      {withAppointment && (
        <fieldset>
          <legend className="label">VFS appointment</legend>
          <div className="grid-2">
            <label className="field"><span>Appointment date</span><input name="vfs_date" type="date" defaultValue={v.vfs_date ?? ''} /></label>
            <label className="field">
              <span>Appointment type</span>
              <select name="vfs_fee_type" defaultValue={v.vfs_fee_type ?? ''}>
                <option value="">Not booked</option>
                <option value="standard">Standard (within 3 weeks)</option>
                <option value="extended">Extended (next day)</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}
    </>
  );
}
