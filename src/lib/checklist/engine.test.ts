import { describe, expect, it } from 'vitest';
import { addDays, addMonths, ageOn } from './dates';
import { feeFor, generateChecklist, summarise } from './engine';
import { maltaStudentNational } from './malta';
import type { ApplicantFacts } from './types';

const today = '2026-11-06';

const adult: ApplicantFacts = {
  dateOfBirth: '2002-03-10',
  passportExpiry: '2032-01-01',
  courseStart: '2027-02-01',
  courseMonths: 12,
  mqfLevel: 6,
  funding: 'self',
  accommodation: 'school',
  hostSecondaryAddress: false,
  appointmentDate: null,
  appointmentType: null,
};

const codes = (facts: ApplicantFacts) =>
  generateChecklist(maltaStudentNational, facts, today).items.map((i) => i.code);

describe('personalised checklist', () => {
  it('gives a self-funded adult on MQF 6 with school accommodation the base set', () => {
    expect(codes(adult)).toEqual([
      '01', '02', '03', '04', '05', '05-payment', '06', '06-certificate', '07',
      '08-mqf5', '08-benefits', '09', '10-school', '12',
    ]);
  });

  it('adds the three sponsor documents when sponsored', () => {
    const c = codes({ ...adult, funding: 'sponsored' });
    expect(c).toEqual(expect.arrayContaining(['06-sponsor-statement', '06-sponsor-declaration', '06-sponsor-id']));
  });

  it('swaps the insurance variant at MQF level 4 and below', () => {
    const c = codes({ ...adult, mqfLevel: 4 });
    expect(c).toContain('08-mqf4');
    expect(c).not.toContain('08-mqf5');
  });

  it('requires a return ticket only for courses under six months', () => {
    expect(codes({ ...adult, courseMonths: 5 })).toContain('09-return');
    expect(codes({ ...adult, courseMonths: 6 })).not.toContain('09-return');
  });

  it('adds the minor documents for an applicant under 18', () => {
    const c = codes({ ...adult, dateOfBirth: '2010-06-01' });
    expect(c).toEqual(expect.arrayContaining(['11-birth-certificate', '11-parents-passport', '11-consent-letter']));
    expect(codes(adult)).not.toContain('11-birth-certificate');
  });

  it('treats an applicant who turns 18 before the appointment as an adult', () => {
    const facts = { ...adult, dateOfBirth: '2008-12-01', appointmentDate: '2026-12-15' };
    expect(codes(facts)).not.toContain('11-birth-certificate');
  });

  it.each([
    ['school', '10-school'],
    ['lease', '10-lease'],
    ['hotel', '10-hotel'],
  ] as const)('gives the %s accommodation branch only its own document', (type, code) => {
    const c = codes({ ...adult, accommodation: type });
    expect(c.filter((x) => x.startsWith('10-'))).toEqual([code]);
  });

  it('adds the residence proof for a host only at a secondary address', () => {
    const host = { ...adult, accommodation: 'host' as const };
    expect(codes(host)).not.toContain('10-host-residence');
    expect(codes({ ...host, hostSecondaryAddress: true })).toContain('10-host-residence');
  });

  it('holds back accommodation items and says why when the type is unknown', () => {
    const result = generateChecklist(maltaStudentNational, { ...adult, accommodation: null }, today);
    expect(result.items.some((i) => i.code.startsWith('10-'))).toBe(false);
    expect(result.unresolved.map((u) => u.code)).toContain('10-school');
    expect(result.warnings.some((w) => w.code === 'missing_accommodation')).toBe(true);
  });

  it('does not ask a student to upload items that the agent produces', () => {
    const agentItems = maltaStudentNational.requirements.filter((r) => r.provider === 'agent').map((r) => r.code);
    expect(agentItems).toEqual(['04', '12']);
  });
});

describe('deadlines and warnings', () => {
  it('computes the VFS, entry and passport dates from the course start', () => {
    const { deadlines } = generateChecklist(maltaStudentNational, adult, today);
    expect(deadlines.vfsLatestDate).toBe('2026-11-30');
    expect(deadlines.earliestEntryDate).toBe('2027-01-18');
    expect(deadlines.passportValidUntil).toBe('2027-12-01');
  });

  it('blocks when the passport expires inside the 10 month window', () => {
    const result = generateChecklist(maltaStudentNational, { ...adult, passportExpiry: '2027-10-01' }, today);
    expect(result.warnings.find((w) => w.code === 'passport_validity')?.severity).toBe('blocker');
  });

  it('blocks an appointment later than 9 weeks before the course', () => {
    const result = generateChecklist(maltaStudentNational, { ...adult, appointmentDate: '2026-12-10' }, today);
    expect(result.warnings.map((w) => w.code)).toContain('appointment_too_late');
  });

  it('blocks when no appointment is booked and the window has closed', () => {
    const result = generateChecklist(maltaStudentNational, { ...adult, courseStart: '2026-12-01' }, today);
    expect(result.warnings.map((w) => w.code)).toContain('vfs_window_passed');
  });

  it('warns instead of guessing when the course start is missing', () => {
    const result = generateChecklist(maltaStudentNational, { ...adult, courseStart: null }, today);
    expect(result.deadlines.vfsLatestDate).toBeNull();
    expect(result.warnings.map((w) => w.code)).toContain('course_start_missing');
  });
});

describe('fees', () => {
  it.each([
    [3, 0, 0],
    [5, 0, 0],
    [6, 50, 50],
    [11, 50, 50],
    [12, 100, 150],
    [30, 100, 150],
  ])('age %i pays %i standard and %i extended', (age, standard, extended) => {
    expect(feeFor(age)).toEqual({ standard, extended });
  });

  it('picks the amount from the appointment type', () => {
    const base = generateChecklist(maltaStudentNational, adult, today).fee;
    expect(base.amount).toBeNull();
    expect(generateChecklist(maltaStudentNational, { ...adult, appointmentType: 'extended' }, today).fee.amount).toBe(150);
  });
});

describe('readiness', () => {
  const approved = { mandatory: true, status: 'approved', physicalRequired: false, physicalReceived: false } as const;

  it('is ready for submission when every mandatory item is approved', () => {
    const r = summarise([approved, { ...approved, mandatory: false, status: 'missing' }]);
    expect(r.readyForSubmission).toBe(true);
  });

  it('is not ready while a mandatory item is pending', () => {
    expect(summarise([approved, { ...approved, status: 'pending' }]).readyForSubmission).toBe(false);
  });

  it('keeps the VFS bundle open until physical copies are received', () => {
    const r = summarise([{ ...approved, physicalRequired: true }]);
    expect(r.readyForSubmission).toBe(true);
    expect(r.readyForVfs).toBe(false);
    expect(summarise([{ ...approved, physicalRequired: true, physicalReceived: true }]).readyForVfs).toBe(true);
  });

  it('is never ready with an empty checklist', () => {
    expect(summarise([]).readyForSubmission).toBe(false);
  });
});

describe('date helpers', () => {
  it('clamps month ends', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });
  it('adds days across a month boundary', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
  it('counts whole years', () => {
    expect(ageOn('2008-12-01', '2026-11-30')).toBe(17);
    expect(ageOn('2008-12-01', '2026-12-01')).toBe(18);
  });
});
