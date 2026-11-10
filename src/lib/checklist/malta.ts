import type { Localised, Predicate, RequirementDef, TemplateDef } from './types';

const L = (en: string, fr: string): Localised => ({ en, fr });
const none: Localised = L('', '');

type Spec = Omit<RequirementDef, 'kind' | 'provider' | 'mandatory' | 'physicalDefault' | 'when' | 'reviewPoints' | 'help'> &
  Partial<Pick<RequirementDef, 'kind' | 'provider' | 'mandatory' | 'physicalDefault' | 'when' | 'reviewPoints' | 'help'>>;

const req = (s: Spec): RequirementDef => ({
  kind: 'document',
  provider: 'student',
  mandatory: true,
  physicalDefault: false,
  when: [],
  reviewPoints: [],
  help: none,
  ...s,
});

const sponsored: Predicate[] = [{ field: 'funding', op: 'eq', value: 'sponsored' }];
const accommodation = (v: string): Predicate => ({ field: 'accommodation', op: 'eq', value: v });
const minor: Predicate[] = [{ field: 'isMinor', op: 'truthy' }];

const schengenCover = L('Valid for the Schengen area', "Valable dans l'espace Schengen");
const minCover = L('Minimum medical coverage of €30,000', 'Couverture médicale minimale de 30 000 €');
const studyPurpose = L('Valid for study purpose', 'Valable pour des études');

export const maltaStudentNational: TemplateDef = {
  country: 'MT',
  visaType: 'student_national_visa_over_90_days',
  version: '2.1',
  issuedOn: '2025-08-13',
  source: 'Identità, Central Visa Unit: Documentation required for Student National Visa (for visas of more than 90 days), version 2.1 dated 13.08.2025',
  generalNotes: [
    L('All documents must be submitted in English.', 'Tous les documents doivent être soumis en anglais.'),
    L(
      'Documents that need translating must be translated by a translator on the authorised list of the Maltese authorities.',
      'Les documents à traduire doivent être traduits par un traducteur figurant sur la liste officielle des autorités maltaises.',
    ),
  ],
  requirements: [
    req({
      code: '01',
      sort: 10,
      pdfRef: '01',
      title: L('Visa application form, signed', 'Formulaire de demande de visa, signé'),
      help: L('Fully filled in and signed by the applicant.', 'Entièrement rempli et signé par le demandeur.'),
      physicalDefault: true,
    }),
    req({
      code: '02',
      sort: 20,
      pdfRef: '02',
      title: L('Passport', 'Passeport'),
      help: L('The passport must be valid for at least 10 months.', 'Le passeport doit être valable au moins 10 mois.'),
      reviewPoints: [L('Validity of at least 10 months', 'Validité d’au moins 10 mois')],
      physicalDefault: true,
    }),
    req({
      code: '03',
      sort: 30,
      pdfRef: '03',
      title: L('Passport photo', 'Photo d’identité'),
      help: L('One photo that meets ICAO standards.', 'Une photo conforme aux normes OACI.'),
      physicalDefault: true,
    }),
    req({
      code: '04',
      sort: 40,
      pdfRef: '04',
      provider: 'agent',
      title: L('VFS appointment letter', 'Lettre de rendez-vous VFS'),
      help: L(
        'The application must be submitted at least 9 weeks before the course starts.',
        'La demande doit être déposée au moins 9 semaines avant le début du cours.',
      ),
      physicalDefault: true,
    }),
    req({
      code: '05',
      sort: 50,
      pdfRef: '05',
      title: L('School enrolment letter', 'Lettre d’inscription de l’établissement'),
      help: L(
        'The letter must state the details below clearly.',
        'La lettre doit indiquer clairement les informations ci-dessous.',
      ),
      reviewPoints: [
        L('Institution name, as registered with MFHEA', 'Nom de l’établissement, tel qu’enregistré auprès du MFHEA'),
        L('Full course name, as listed on the MFHEA website', 'Nom complet du cours, tel que publié sur le site du MFHEA'),
        L('MQF level', 'Niveau MQF'),
        L('Number of ECTS', 'Nombre d’ECTS'),
        L(
          'Duration in months covered by the letter, and type (full time or part time)',
          'Durée en mois couverte par la lettre, et type (temps plein ou temps partiel)',
        ),
        L(
          'Course hiatus periods, such as Easter and summer holidays',
          'Périodes d’interruption, comme les vacances de Pâques et d’été',
        ),
        L(
          'Course hours per week, specifying contact hours',
          'Heures de cours par semaine, avec les heures de contact précisées',
        ),
        L('Address where the student will attend lectures', 'Adresse où l’étudiant suivra les cours'),
      ],
    }),
    req({
      code: '05-payment',
      sort: 51,
      pdfRef: '05',
      title: L('Proof of payment', 'Preuve de paiement'),
      help: L('A receipt or an invoice.', 'Un reçu ou une facture.'),
    }),
    req({
      code: '06',
      sort: 60,
      pdfRef: '06',
      title: L('Bank statements, last 3 months', 'Relevés bancaires des 3 derniers mois'),
      help: L(
        'The funds must be at least 75% of the national minimum wage for every month of study.',
        'Les fonds doivent représenter au moins 75 % du salaire minimum national pour chaque mois d’études.',
      ),
      reviewPoints: [
        L('Covers the last 3 months', 'Couvre les 3 derniers mois'),
        L(
          'Funds of at least 75% of the national minimum wage for every month of study',
          'Fonds d’au moins 75 % du salaire minimum national pour chaque mois d’études',
        ),
      ],
    }),
    req({
      code: '06-certificate',
      sort: 61,
      pdfRef: '06',
      title: L('Recent bank certificate', 'Attestation bancaire récente'),
      help: L(
        'It must show adequate funds to support the stay in Malta.',
        'Elle doit montrer des fonds suffisants pour le séjour à Malte.',
      ),
    }),
    req({
      code: '06-sponsor-statement',
      sort: 62,
      pdfRef: '06 i',
      title: L('Sponsor’s bank statements, last 3 months', 'Relevés bancaires du garant, 3 derniers mois'),
      when: sponsored,
    }),
    req({
      code: '06-sponsor-declaration',
      sort: 63,
      pdfRef: '06 ii',
      title: L('Sponsor’s declaration letter, signed', 'Lettre de déclaration du garant, signée'),
      when: sponsored,
      physicalDefault: true,
    }),
    req({
      code: '06-sponsor-id',
      sort: 64,
      pdfRef: '06 iii',
      title: L('Sponsor’s ID card or passport', 'Pièce d’identité ou passeport du garant'),
      help: L(
        'ID card front and back, or the passport page with the photo. Both sides can be in one file.',
        'Pièce d’identité recto et verso, ou page du passeport avec la photo. Les deux faces peuvent être dans un seul fichier.',
      ),
      when: sponsored,
    }),
    req({
      code: '07',
      sort: 70,
      pdfRef: '07',
      title: L('International bank card, front and back', 'Carte bancaire internationale, recto et verso'),
      help: L(
        'The card the student will use to access funds in Malta. Both sides can be in one file.',
        'La carte que l’étudiant utilisera pour accéder à ses fonds à Malte. Les deux faces peuvent être dans un seul fichier.',
      ),
    }),
    req({
      code: '08-mqf5',
      sort: 80,
      pdfRef: '08',
      title: L('Medical and travel insurance', 'Assurance maladie et voyage'),
      help: L(
        'For students on MQF level 5 and over who can apply for a study residence permit once in Malta.',
        'Pour les étudiants de niveau MQF 5 et plus pouvant demander un permis de résidence pour études une fois à Malte.',
      ),
      when: [{ field: 'mqfLevel', op: 'gte', value: 5 }],
      reviewPoints: [
        schengenCover,
        minCover,
        L(
          'Covers at least 91 consecutive days from the first point of entry in the Schengen area',
          'Couvre au moins 91 jours consécutifs à partir de la première entrée dans l’espace Schengen',
        ),
        studyPurpose,
      ],
    }),
    req({
      code: '08-mqf4',
      sort: 81,
      pdfRef: '08',
      title: L('Medical and travel insurance', 'Assurance maladie et voyage'),
      help: L('For students on MQF level 4 and under.', 'Pour les étudiants de niveau MQF 4 et moins.'),
      when: [{ field: 'mqfLevel', op: 'lt', value: 5 }],
      reviewPoints: [
        schengenCover,
        minCover,
        L(
          'Valid for the whole stay, from the first point of entry in the Schengen area until exit',
          'Valable pendant tout le séjour, de la première entrée dans l’espace Schengen jusqu’à la sortie',
        ),
        studyPurpose,
      ],
    }),
    req({
      code: '08-benefits',
      sort: 82,
      pdfRef: '08',
      title: L('Table of benefits', 'Tableau des garanties'),
      help: L(
        'Only needed if the certificate of insurance does not show the details above.',
        'Nécessaire uniquement si le certificat d’assurance n’indique pas les informations ci-dessus.',
      ),
      mandatory: false,
      when: [{ field: 'mqfLevel', op: 'gte', value: 1 }],
    }),
    req({
      code: '09',
      sort: 90,
      pdfRef: '09',
      title: L('Flight itinerary to Malta', 'Itinéraire de vol vers Malte'),
      help: L(
        'The full itinerary with the student’s name, the date of the flight and all stops. Arrival must be no more than two weeks before the course starts.',
        'L’itinéraire complet avec le nom de l’étudiant, la date du vol et toutes les escales. L’arrivée ne doit pas avoir lieu plus de deux semaines avant le début du cours.',
      ),
      reviewPoints: [
        L('Student’s name, date of flight and all stops shown', 'Nom de l’étudiant, date du vol et toutes les escales indiqués'),
        L('Entry no more than two weeks before the course starts', 'Entrée au plus deux semaines avant le début du cours'),
      ],
    }),
    req({
      code: '09-return',
      sort: 91,
      pdfRef: '09',
      title: L('Return ticket', 'Billet de retour'),
      help: L(
        'Required because the course is shorter than six months. The ticket must be for after the course ends.',
        'Obligatoire car le cours dure moins de six mois. Le billet doit être postérieur à la fin du cours.',
      ),
      when: [{ field: 'courseMonths', op: 'lt', value: 6 }],
    }),
    req({
      code: '10-school',
      sort: 100,
      pdfRef: '10 a',
      title: L('Accommodation letter from the school', 'Lettre d’hébergement de l’établissement'),
      help: L(
        'On the school’s letterhead, signed and stamped. It must state name, surname, passport number, address and duration of accommodation.',
        'Sur papier à en-tête de l’établissement, signée et tamponnée. Elle doit indiquer nom, prénom, numéro de passeport, adresse et durée de l’hébergement.',
      ),
      when: [accommodation('school')],
      reviewPoints: [L('In the applicant’s name, covering the first 14 nights', 'Au nom du demandeur, couvrant les 14 premières nuits')],
      physicalDefault: true,
    }),
    req({
      code: '10-lease',
      sort: 101,
      pdfRef: '10 b',
      title: L('Registered lease agreement', 'Contrat de location enregistré'),
      help: L(
        'Signed by both parties. It must state the duration, home address, the applicant’s name and the rent.',
        'Signé par les deux parties. Il doit indiquer la durée, l’adresse, le nom du demandeur et le loyer.',
      ),
      when: [accommodation('lease')],
      reviewPoints: [L('In the applicant’s name, covering the first 14 nights', 'Au nom du demandeur, couvrant les 14 premières nuits')],
      physicalDefault: true,
    }),
    req({
      code: '10-host-declaration',
      sort: 102,
      pdfRef: '10 c i',
      title: L('Host’s declaration', 'Déclaration de l’hébergeant'),
      help: L(
        'Signed and stamped by a local lawyer or notary.',
        'Signée et tamponnée par un avocat ou un notaire local.',
      ),
      when: [accommodation('host')],
      physicalDefault: true,
    }),
    req({
      code: '10-host-id',
      sort: 103,
      pdfRef: '10 c ii',
      title: L('Host’s identity card', 'Pièce d’identité de l’hébergeant'),
      help: L('A copy of the host’s identity card.', 'Une copie de la pièce d’identité de l’hébergeant.'),
      when: [accommodation('host')],
    }),
    req({
      code: '10-host-residence',
      sort: 104,
      pdfRef: '10 c iii',
      title: L('Proof of the host’s link to the residence', 'Preuve du lien de l’hébergeant avec le logement'),
      help: L(
        'Needed when the applicant stays at a secondary address. A contract of sale, lease agreement or utility bill.',
        'Nécessaire si le demandeur est hébergé à une adresse secondaire. Un contrat de vente, un contrat de location ou une facture de services.',
      ),
      when: [accommodation('host'), { field: 'hostSecondaryAddress', op: 'truthy' }],
    }),
    req({
      code: '10-hotel',
      sort: 105,
      pdfRef: '10 d',
      title: L('Hotel or short-term rental booking', 'Réservation d’hôtel ou de location de courte durée'),
      help: L(
        'A booking of at least 14 consecutive nights from the planned arrival date in Malta.',
        'Une réservation d’au moins 14 nuits consécutives à partir de la date d’arrivée prévue à Malte.',
      ),
      when: [accommodation('hotel')],
      reviewPoints: [L('In the applicant’s name, at least 14 consecutive nights', 'Au nom du demandeur, au moins 14 nuits consécutives')],
    }),
    req({
      code: '11-birth-certificate',
      sort: 110,
      pdfRef: '11 i',
      title: L('Birth certificate', 'Acte de naissance'),
      help: L(
        'The original, legalised and translated into English by an official translator.',
        'L’original, légalisé et traduit en anglais par un traducteur officiel.',
      ),
      when: minor,
      physicalDefault: true,
    }),
    req({
      code: '11-parents-passport',
      sort: 111,
      pdfRef: '11 ii',
      title: L('Copy of the parents’ passports', 'Copie des passeports des parents'),
      when: minor,
    }),
    req({
      code: '11-consent-letter',
      sort: 112,
      pdfRef: '11 iii',
      title: L('Parents’ consent letter', 'Lettre de consentement des parents'),
      help: L('The original, with a translation into English.', 'L’original, avec une traduction en anglais.'),
      when: minor,
      physicalDefault: true,
    }),
    req({
      code: '12',
      sort: 120,
      pdfRef: '12',
      kind: 'step',
      provider: 'agent',
      title: L('Visa fee', 'Frais de visa'),
      help: L('Paid by credit or visa card.', 'Payés par carte de crédit ou carte Visa.'),
      mandatory: false,
    }),
  ],
};
