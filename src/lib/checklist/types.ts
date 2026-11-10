export type FactField =
  | 'isMinor'
  | 'mqfLevel'
  | 'courseMonths'
  | 'funding'
  | 'accommodation'
  | 'hostSecondaryAddress';

export type Predicate = {
  field: FactField;
  op: 'eq' | 'lt' | 'gte' | 'truthy';
  value?: string | number;
};

export type Localised = { en: string; fr: string };

export type RequirementDef = {
  code: string;
  sort: number;
  kind: 'document' | 'step';
  provider: 'student' | 'agent';
  title: Localised;
  help: Localised;
  mandatory: boolean;
  physicalDefault: boolean;
  when: Predicate[];
  reviewPoints: Localised[];
  pdfRef: string;
};

export type TemplateDef = {
  country: string;
  visaType: string;
  version: string;
  issuedOn: string;
  source: string;
  generalNotes: Localised[];
  requirements: RequirementDef[];
};

export type ApplicantFacts = {
  dateOfBirth: string;
  passportExpiry: string | null;
  courseStart: string | null;
  courseMonths: number | null;
  mqfLevel: number | null;
  funding: 'self' | 'sponsored' | null;
  accommodation: 'school' | 'lease' | 'host' | 'hotel' | null;
  hostSecondaryAddress: boolean;
  appointmentDate: string | null;
  appointmentType: 'standard' | 'extended' | null;
};

export type Warning = {
  code: string;
  severity: 'blocker' | 'warning';
  message: string;
};

export type Unresolved = { code: string; title: Localised; missing: FactField[] };

export type Checklist = {
  items: RequirementDef[];
  unresolved: Unresolved[];
  warnings: Warning[];
  deadlines: {
    vfsLatestDate: string | null;
    earliestEntryDate: string | null;
    passportValidUntil: string | null;
  };
  fee: { ageYears: number; standard: number; extended: number; amount: number | null };
};

export type ItemState = {
  mandatory: boolean;
  status: 'missing' | 'pending' | 'approved' | 'rejected';
  physicalRequired: boolean;
  physicalReceived: boolean;
};

export type Readiness = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  missing: number;
  physicalOutstanding: number;
  readyForSubmission: boolean;
  readyForVfs: boolean;
};
