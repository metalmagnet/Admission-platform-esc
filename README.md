---
created: 2026-11-06
type: project
tags: [visa-platform, malta, mvp]
status: draft
audience: internal
source: self
---

# Admissions and visas platform, first slice

Internal tool for the 3 admission agents. It replaces WhatsApp and email attachments for collecting student visa documents. The first slice covers the Malta student national visa (more than 90 days), built from the Identità Central Visa Unit checklist, version 2.1 dated 13.08.2025.

## What works in this slice

- Agent login (admin and agent roles). Agents see only their own applicants, admins see everyone.
- Create an applicant. Duplicates are caught by passport number or by name plus date of birth, and the agent has to confirm before a second profile is created.
- Each applicant gets a personalised checklist generated from the PDF: sponsor documents, insurance variant by MQF level, return ticket under 6 months, the four accommodation branches, minor documents, plus the 9-week VFS deadline, the 2-week entry window, passport validity, and the fee by age and appointment type. Anything that depends on a detail you have not entered yet is held back and flagged.
- A secure upload link per student (random token, only its hash is stored, valid 14 days, replaceable and cancellable). The student portal needs no account and works in English and French. It shows only what the student has to provide.
- Agents can also upload a file on the student's behalf, which covers documents that still arrive on WhatsApp.
- Review: preview, download, tick the review points (the 8 details of the enrolment letter, the insurance conditions and so on), approve, or reject with a reason the student sees. Every upload is a new version and old versions stay.
- Physical copies: each document can be flagged as needing a physical copy, with a received tick. The VFS bundle page lists what to carry and what is still missing.
- Uploads are checked by their real file signature (PDF, JPG, PNG), limited to 10 MB, and hashed. The same file attached to two items or two applicants raises a warning.
- Dashboard counts and filters on the applicants page. Audit log on every upload, view, download, decision and stage change.

## Setup

1. Create a Supabase project in an EU region.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill it in. `NATIONAL_MIN_WAGE_EUR_MONTHLY` is optional: the PDF gives 75% of the minimum wage but not the figure.
4. `npm install`, then `npm run seed` to load the Malta checklist.
5. Create the 3 agents under Authentication, Users in Supabase. A profile is created for each. Set your own to admin: `update profiles set role = 'admin' where id = '<your user id>';`
6. `npm run dev`, or `npm run build` and `npm start`.

`npm test` runs the checklist and upload tests. `npm run typecheck` checks the types.

## Checked and not checked

Checked: 35 unit tests on the checklist rules, deadlines, fees, readiness and upload validation. Type check and production build pass. The login page renders, protected pages redirect to it, and the security headers are set. The SQL migration parses.

Not checked: nothing here has run against a real Supabase project. Row level security, storage, the `add_document` function, the upload flow end to end, and the review screens have not been exercised with real data. Expect to fix small things on the first run, so do the first pass with dummy documents and a throwaway applicant, not a real passport.

## Assumptions to confirm with the agents

- Passport validity: the PDF says 10 months but not counted from when. The check uses the course start date, the most cautious reading.
- Which documents need a physical copy by default: the form, passport, photo, the VFS letter, the signed or stamped school, lease and host letters, the sponsor declaration, and the birth certificate and consent letter for minors. Agents can switch this per document.
- Item 05 and item 06 each contain more than one document in the PDF (proof of payment, bank certificate), so they are separate upload slots.
- "Front and back" items (bank card, sponsor ID) are one slot. The student can put both sides in one file.
- Fee age is taken at the appointment date, or today if none is booked. The VFS letter and the fee are done by the agent, not the student. The fee is not required for "ready for submission", since it is paid by card at the appointment.
- The French text is written for this slice and should be read by a native speaker before students see it.

## Not built yet

- Emails. Everything will need agent approval, so the plan is a queue of drafted emails (upload link, reminders, approved and rejected notices) that the agent approves one by one or in a batch, in the student's language, with parents copied for minors. For now the agent copies the upload link and sends it by hand.
- Reminder scheduling, in-app notifications, and a communication history per applicant.
- Admin screens for users, template editing and settings (these are done in Supabase and by seeding).
- Reassigning an applicant to another agent (admin, in SQL for now).
- Data retention and deletion rules, a GDPR export, two-factor sign-in, and rate limiting on the upload link.
- AI document classification. Nothing in this slice makes a decision about a document or an applicant.

## Known limits

- Files travel through the app server. Some hosts cap request bodies (Vercel's is 4.5 MB), which would reject phone photos near the 10 MB limit. Pick a host without that cap, or move uploads to direct storage uploads.
- Encryption at rest and in transit comes from the hosting provider (Supabase storage and TLS). Confirm the settings of the project you create.
- `npm audit` lists PostCSS advisories that come bundled with Next 15. They concern processing untrusted CSS at build time, which this app does not do. They clear with a Next 16 upgrade.
