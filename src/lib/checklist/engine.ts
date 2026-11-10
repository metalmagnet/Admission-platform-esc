import { addDays, addMonths, ageOn } from './dates';
import type {
  ApplicantFacts,
  Checklist,
  FactField,
  ItemState,
  Predicate,
  Readiness,
  RequirementDef,
  TemplateDef,
  Unresolved,
  Warning,
} from './types';

const VFS_LEAD_DAYS = 9 * 7;
const ENTRY_WINDOW_DAYS = 14;
const PASSPORT_MONTHS = 10;

const FIELD_LABELS: Record<FactField, string> = {
  isMinor: 'date of birth',
  mqfLevel: 'MQF level',
  courseMonths: 'course length',
  funding: 'funding (self or sponsored)',
  accommodation: 'accommodation type',
  hostSecondaryAddress: 'host address type',
};

type Resolved = string | number | boolean | undefined;

function resolveField(field: FactField, facts: ApplicantFacts, asOf: string): Resolved {
  switch (field) {
    case 'isMinor':
      return ageOn(facts.dateOfBirth, asOf) < 18;
    case 'mqfLevel':
      return facts.mqfLevel ?? undefined;
    case 'courseMonths':
      return facts.courseMonths ?? undefined;
    case 'funding':
      return facts.funding ?? undefined;
    case 'accommodation':
      return facts.accommodation ?? undefined;
    case 'hostSecondaryAddress':
      return facts.hostSecondaryAddress;
  }
}

function test(predicate: Predicate, value: Resolved): boolean | undefined {
  if (value === undefined) return undefined;
  switch (predicate.op) {
    case 'eq':
      return value === predicate.value;
    case 'lt':
      return Number(value) < Number(predicate.value);
    case 'gte':
      return Number(value) >= Number(predicate.value);
    case 'truthy':
      return Boolean(value);
  }
}

export function feeFor(ageYears: number) {
  if (ageYears <= 5) return { standard: 0, extended: 0 };
  if (ageYears <= 11) return { standard: 50, extended: 50 };
  return { standard: 100, extended: 150 };
}

export function generateChecklist(
  template: TemplateDef,
  facts: ApplicantFacts,
  today: string,
): Checklist {
  const asOf = facts.appointmentDate ?? today;
  const items: RequirementDef[] = [];
  const unresolved: Unresolved[] = [];

  for (const req of [...template.requirements].sort((a, b) => a.sort - b.sort)) {
    const results = req.when.map((p) => ({ p, r: test(p, resolveField(p.field, facts, asOf)) }));
    if (results.some((x) => x.r === false)) continue;
    const missing = results.filter((x) => x.r === undefined).map((x) => x.p.field);
    if (missing.length > 0) {
      unresolved.push({ code: req.code, title: req.title, missing: [...new Set(missing)] });
    } else {
      items.push(req);
    }
  }

  const warnings: Warning[] = [];
  const vfsLatestDate = facts.courseStart ? addDays(facts.courseStart, -VFS_LEAD_DAYS) : null;
  const earliestEntryDate = facts.courseStart ? addDays(facts.courseStart, -ENTRY_WINDOW_DAYS) : null;
  const passportValidUntil = facts.courseStart ? addMonths(facts.courseStart, PASSPORT_MONTHS) : null;

  if (!facts.courseStart) {
    warnings.push({
      code: 'course_start_missing',
      severity: 'warning',
      message: 'Course start date is missing, so the VFS, entry and passport deadlines cannot be calculated.',
    });
  }

  if (facts.passportExpiry && passportValidUntil && facts.passportExpiry < passportValidUntil) {
    warnings.push({
      code: 'passport_validity',
      severity: 'blocker',
      message: `Passport expires on ${facts.passportExpiry}. It needs to be valid until at least ${passportValidUntil} (10 months from the course start). The checklist does not say which date the 10 months counts from, so confirm before submitting.`,
    });
  }

  if (vfsLatestDate) {
    if (facts.appointmentDate && facts.appointmentDate > vfsLatestDate) {
      warnings.push({
        code: 'appointment_too_late',
        severity: 'blocker',
        message: `The appointment on ${facts.appointmentDate} is later than ${vfsLatestDate}, the last date that is 9 weeks before the course starts.`,
      });
    } else if (!facts.appointmentDate && today > vfsLatestDate) {
      warnings.push({
        code: 'vfs_window_passed',
        severity: 'blocker',
        message: `The last date for a VFS appointment (${vfsLatestDate}) has passed and none is booked.`,
      });
    }
  }

  const byField = new Map<FactField, string[]>();
  for (const u of unresolved) {
    for (const f of u.missing) byField.set(f, [...(byField.get(f) ?? []), u.code]);
  }
  for (const [field, codes] of byField) {
    warnings.push({
      code: `missing_${field}`,
      severity: 'warning',
      message: `Add the ${FIELD_LABELS[field]} to generate checklist items ${codes.join(', ')}.`,
    });
  }

  const ageYears = ageOn(facts.dateOfBirth, asOf);
  const { standard, extended } = feeFor(ageYears);
  const amount =
    facts.appointmentType === 'standard' ? standard : facts.appointmentType === 'extended' ? extended : null;

  return {
    items,
    unresolved,
    warnings,
    deadlines: { vfsLatestDate, earliestEntryDate, passportValidUntil },
    fee: { ageYears, standard, extended, amount },
  };
}

export function summarise(states: ItemState[]): Readiness {
  const count = (s: ItemState['status']) => states.filter((i) => i.status === s).length;
  const mandatory = states.filter((i) => i.mandatory);
  const physicalOutstanding = states.filter((i) => i.physicalRequired && !i.physicalReceived).length;
  const readyForSubmission = mandatory.length > 0 && mandatory.every((i) => i.status === 'approved');
  return {
    total: states.length,
    approved: count('approved'),
    pending: count('pending'),
    rejected: count('rejected'),
    missing: count('missing'),
    physicalOutstanding,
    readyForSubmission,
    readyForVfs: readyForSubmission && physicalOutstanding === 0,
  };
}
