const { generateChecklist, summarise, maltaStudentNational: T, text: PT } = Engine;
const TODAY = new Date().toISOString().slice(0, 10);
const addD = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nowStr = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const STAGES = { collecting: 'Collecting documents', ready: 'Ready for submission', submitted: 'Submitted', approved: 'Visa approved', rejected: 'Visa rejected', action_required: 'Action required' };
const STATUS = { missing: 'Missing', pending: 'To review', approved: 'Approved', rejected: 'Rejected' };
const AGENTS = ['Sara', 'Omar'];
let S;
let uid = 0;

function facts(a) {
  return { dateOfBirth: a.dob, passportExpiry: a.pExp || null, courseStart: a.start || null, courseMonths: a.months ? +a.months : null, mqfLevel: a.mqf ? +a.mqf : null, funding: a.funding || null, accommodation: a.acc || null, hostSecondaryAddress: !!a.hostSec, appointmentDate: a.vfsDate || null, appointmentType: a.vfsType || null };
}
const reqOf = (code) => T.requirements.find((r) => r.code === code);
const log = (a, who, what) => a.log.unshift({ at: nowStr(), who, what });

function sync(a) {
  const cl = generateChecklist(T, facts(a), TODAY);
  a.cl = cl;
  const needed = new Set(cl.items.map((i) => i.code));
  for (const it of cl.items) if (!a.items[it.code]) a.items[it.code] = { status: 'missing', reason: '', docs: [], checked: [], physReq: it.physicalDefault, physRec: false };
  for (const code of Object.keys(a.items)) if (!needed.has(code) && a.items[code].status === 'missing' && a.items[code].docs.length === 0) delete a.items[code];
}

function makeApp(f) {
  const a = { id: ++uid, stage: 'collecting', items: {}, linkUrl: null, linkLive: false, log: [], flags: {}, ...f };
  sync(a);
  log(a, f.agent, 'applicant.created');
  return a;
}
const liveCodes = (a) => new Set(a.cl.items.map((i) => i.code));
const liveItems = (a) => a.cl.items.map((def) => ({ def, st: a.items[def.code] }));
const readiness = (a) => summarise(liveItems(a).map(({ def, st }) => ({ mandatory: def.mandatory, status: st.status, physicalRequired: st.physReq && def.kind === 'document', physicalReceived: st.physRec })));
const fullName = (a) => a.first + ' ' + a.last;
const addDoc = (st, name, size, by) => { st.docs.unshift({ name, size, at: nowStr(), by, ver: st.docs.length + 1 }); st.status = 'pending'; st.reason = ''; st.checked = []; };

function seed() {
  const amina = makeApp({ agent: 'Sara', first: 'Amina', last: 'Haddad', dob: '2001-04-12', email: 'amina.h@example.com', lang: 'fr', pass: 'XA1234567', pExp: '2032-01-01', inst: 'Sample College of Business', course: 'Diploma in Business Management', mqf: '5', start: addD(TODAY, 90), months: '12', funding: 'sponsored', acc: 'lease' });
  addDoc(amina.items['01'], 'visa-form-signed.pdf', 421000, 'Sara'); amina.items['01'].status = 'approved';
  addDoc(amina.items['02'], 'passport.jpg', 1800000, 'student'); amina.items['02'].status = 'approved';
  addDoc(amina.items['05'], 'enrolment-letter.pdf', 98000, 'student');
  addDoc(amina.items['05-payment'], 'receipt.jpg', 2400000, 'student'); amina.items['05-payment'].status = 'rejected'; amina.items['05-payment'].reason = 'The receipt is cut off at the bottom. Please send the full page showing the total and the date.';
  amina.flags = { link: true, student: true, reviewed: true }; amina.linkLive = true;
  const yas = makeApp({ agent: 'Sara', first: 'Yassine', last: 'Berrada', dob: '2010-05-14', email: 'y.berrada@example.com', parentName: 'Karim Berrada', parentEmail: 'k.berrada@example.com', lang: 'fr', pass: 'XB7654321', pExp: '2031-06-01', inst: 'Sample Language School', course: 'General English', mqf: '3', start: addD(TODAY, 70), months: '5', funding: 'self', acc: 'school', vfsDate: addD(TODAY, 5), vfsType: 'standard' });
  for (const [c, it] of Object.entries(yas.items)) if (it.status === 'missing' && reqOf(c).kind === 'document' && !['04', '06', '07'].includes(c)) { addDoc(it, c + '-scan.pdf', 300000, 'student'); it.status = 'approved'; }
  addDoc(yas.items['06'], 'bank-statements.pdf', 640000, 'student');
  yas.flags = { link: true, student: true, reviewed: true }; yas.linkLive = true;
  const lina = makeApp({ agent: 'Omar', first: 'Lina', last: 'Chraibi', dob: '1999-09-30', email: 'lina.c@example.com', lang: 'en', pass: 'XC1112223', pExp: '2031-03-01', inst: 'Sample College of Business', course: 'Certificate in Marketing', mqf: '6', start: addD(TODAY, 115), months: '9', funding: 'self', acc: 'hotel', vfsDate: addD(TODAY, 20), vfsType: 'standard' });
  for (const [c, it] of Object.entries(lina.items)) if (reqOf(c).kind === 'document') { addDoc(it, c + '-scan.pdf', 250000, 'student'); it.status = 'approved'; it.physRec = it.physReq; }
  lina.stage = 'ready'; lina.flags = { link: true, student: true, reviewed: true };
  S.apps.push(amina, yas, lina);
}

function init() {
  S = { apps: [], cur: null, view: 'list', lang: null, toast: '', modal: null, q: '', stage: '', dup: null, form: null };
  uid = 0; seed(); render();
}
const cur = () => S.apps.find((a) => a.id === S.cur);
const toast = (m) => { S.toast = m; render(); clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = ''; render(); }, 3500); };
const go = (view, id) => { if (id !== undefined) S.cur = id; S.view = view; S.dup = null; S.lang = null; render(); window.scrollTo(0, 0); };

/* ---------- guide ---------- */
const GUIDE = [
  ['Create profile', (a) => !!a],
  ['Checklist generated', (a) => !!a],
  ['Send upload link', (a) => a?.flags.link],
  ['Student uploads', (a) => a?.flags.student],
  ['Agent reviews', (a) => a?.flags.reviewed],
  ['Ready for submission', (a) => a && a.stage !== 'collecting' && a.stage !== 'action_required'],
  ['VFS bundle', (a) => a?.flags.vfs],
  ['Submitted', (a) => a && ['submitted', 'approved', 'rejected'].includes(a.stage)],
];
const HINTS = ['Create a student profile.', 'The checklist appears on its own.', 'Create the secure upload link, then open it as the student.', 'As the student, upload a document.', 'Back as the agent, approve or reject what came in.', 'Approve every mandatory document, then mark the application ready.', 'Open the VFS bundle and tick off the physical documents.', 'Record the application as submitted.'];
function guide() {
  const a = S.view === 'list' || S.view === 'new' ? null : cur();
  const done = GUIDE.map(([, f]) => !!f(a));
  const next = done.indexOf(false);
  return `<div class="guide"><ol>${GUIDE.map(([t], i) => `<li class="${done[i] ? 'done' : i === next ? 'now' : ''}"><span>${done[i] ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol><p>${next === -1 ? 'The full flow is complete.' : 'Next: ' + HINTS[next]}</p></div>`;
}

/* ---------- views ---------- */
function chip(s, label) { return `<span class="chip ${s}">${esc(label ?? STATUS[s])}</span>`; }
function switcher() {
  const on = S.view === 'new' ? '' : S.view;
  const tabs = [['list', 'Applicants'], ['work', 'Applicant workspace'], ['vfs', 'VFS bundle'], ['portal', 'Student portal']];
  return `<div class="switch" role="navigation" aria-label="Screens">${tabs.map(([v, l]) => `<button data-act="jump" data-v="${v}" aria-pressed="${on === v}">${l}</button>`).join('')}</div>`;
}
function topBar() {
  return `<header class="topbar"><div class="shell"><span class="brand">Admissions and visas</span><nav><a data-act="go" data-v="list">Applicants</a><a data-act="go" data-v="new">New applicant</a></nav><div class="who">Sara (agent)<button class="btn small quiet" data-act="reset">Reset demo</button></div></div></header>`;
}

function viewList() {
  const rows = S.apps.map((a) => {
    const r = readiness(a);
    const vfsLatest = a.cl.deadlines.vfsLatestDate;
    const dl = a.vfsDate || vfsLatest;
    const over = !a.vfsDate && vfsLatest && vfsLatest < TODAY && ['collecting', 'ready'].includes(a.stage);
    return { a, r, dl, over };
  });
  const open = rows.filter((x) => ['collecting', 'ready', 'action_required'].includes(x.a.stage));
  const tally = [['Active applicants', rows.filter((x) => x.a.stage !== 'approved' && x.a.stage !== 'rejected').length], ['Awaiting documents', open.filter((x) => x.r.missing + x.r.rejected > 0).length], ['Documents to review', rows.reduce((n, x) => n + x.r.pending, 0)], ['Ready for submission', rows.filter((x) => x.a.stage === 'ready').length], ['Submitted', rows.filter((x) => x.a.stage === 'submitted').length], ['Approved / rejected', rows.filter((x) => x.a.stage === 'approved').length + ' / ' + rows.filter((x) => x.a.stage === 'rejected').length], ['Past VFS deadline', rows.filter((x) => x.over).length, 1]];
  const q = S.q.toLowerCase();
  const shown = rows.filter((x) => (!q || (fullName(x.a) + x.a.email + (x.a.inst || '')).toLowerCase().includes(q)) && (!S.stage || x.a.stage === S.stage)).sort((x, y) => (x.dl || '9999').localeCompare(y.dl || '9999'));
  return `<main class="shell"><div class="page-head"><div><h1>Applicants</h1><p>Everyone on the team, soonest deadline first.</p></div><button class="btn primary" data-act="go" data-v="new">New applicant</button></div>
  <div class="tally">${tally.map(([l, v, al]) => `<div${al ? ' class="alert"' : ''}><strong>${v}</strong><span class="label">${l}</span></div>`).join('')}</div>
  <div class="grid-3" style="padding:24px 0"><label class="field"><span>Search</span><input id="q" value="${esc(S.q)}" placeholder="Name, email or institution"></label><label class="field"><span>Stage</span><select id="stagef"><option value="">All stages</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}"${S.stage === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
  <div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Course</th><th>Stage</th><th>Documents</th><th>VFS</th><th>Agent</th></tr></thead><tbody>${shown.map(({ a, r, dl, over }) => `<tr><td><a data-act="open" data-id="${a.id}"><strong>${esc(fullName(a))}</strong></a><div class="muted small">${esc(a.email)}</div></td><td>${esc(a.inst || 'Not set')}<div class="muted small">${a.start ? 'Starts ' + a.start : ''}</div></td><td>${STAGES[a.stage]}</td><td>${r.approved} of ${r.total} approved<div class="small">${r.pending ? chip('pending', r.pending + ' to review') + ' ' : ''}${r.rejected ? chip('rejected', r.rejected + ' rejected') : ''}</div></td><td>${dl || '<span class="muted">No date</span>'}<div class="small muted">${a.vfsDate ? 'Booked' : dl ? 'Latest booking date' : ''}</div>${over ? chip('rejected', 'Past deadline') : ''}</td><td>${a.agent}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing matches these filters.</td></tr>'}</tbody></table></div></main>`;
}

function viewNew() {
  const f = S.form || {};
  const v = (k) => esc(f[k] ?? '');
  const sel = (k, opts) => opts.map(([val, lab]) => `<option value="${val}"${(f[k] ?? '') === val ? ' selected' : ''}>${lab}</option>`).join('');
  const dup = S.dup;
  return `<main class="shell" style="max-width:820px"><div class="page-head"><div><h1>New applicant</h1><p>Only the name, date of birth and email are needed to start. Anything you leave blank is flagged on the checklist, and the matching items appear once you fill it in.</p></div><button class="btn" data-act="fill">Fill with a sample student</button></div>
  ${S.err ? `<p class="error" role="alert">${esc(S.err)}</p>` : ''}
  ${dup ? `<div class="notice blocker" role="alert" style="margin-bottom:16px"><p>This looks like someone who is already in the system:</p><ul>${dup.map((d) => `<li>${esc(fullName(d))} (same passport number, or same name and date of birth)</li>`).join('')}</ul><label class="check" style="margin-top:8px"><input type="checkbox" id="confirmdup"><span>This is a different person. Create the profile anyway.</span></label></div>` : ''}
  <form id="newform" class="stack" onsubmit="return false">
  <fieldset><legend class="label">Student</legend><div class="grid-2">
  <label class="field"><span>First name</span><input name="first" value="${v('first')}"></label><label class="field"><span>Last name</span><input name="last" value="${v('last')}"></label>
  <label class="field"><span>Date of birth</span><input type="date" name="dob" value="${v('dob')}"></label><label class="field"><span>Email</span><input type="email" name="email" value="${v('email')}"></label>
  <label class="field"><span>Language for the upload portal and emails</span><select name="lang">${sel('lang', [['en', 'English'], ['fr', 'Français']])}</select></label></div></fieldset>
  <fieldset><legend class="label">Parents or guardian (required if under 18)</legend><div class="grid-3"><label class="field"><span>Name</span><input name="parentName" value="${v('parentName')}"></label><label class="field"><span>Email</span><input type="email" name="parentEmail" value="${v('parentEmail')}"></label></div></fieldset>
  <fieldset><legend class="label">Passport</legend><div class="grid-2"><label class="field"><span>Passport number</span><input name="pass" value="${v('pass')}"></label><label class="field"><span>Passport expiry</span><input type="date" name="pExp" value="${v('pExp')}"></label></div></fieldset>
  <fieldset><legend class="label">Course</legend><div class="grid-2"><label class="field"><span>Institution</span><input name="inst" value="${v('inst')}"></label><label class="field"><span>Course name</span><input name="course" value="${v('course')}"></label><label class="field"><span>MQF level (1 to 8)</span><input type="number" min="1" max="8" name="mqf" value="${v('mqf')}"></label><label class="field"><span>Course start</span><input type="date" name="start" value="${v('start')}"></label><label class="field"><span>Course length in months</span><input type="number" min="1" name="months" value="${v('months')}"></label></div></fieldset>
  <fieldset><legend class="label">Funding and accommodation</legend><div class="grid-2"><label class="field"><span>Who pays for the stay</span><select name="funding">${sel('funding', [['', 'Not set yet'], ['self', 'The student'], ['sponsored', 'A sponsor']])}</select></label><label class="field"><span>Accommodation for the first 14 nights</span><select name="acc">${sel('acc', [['', 'Not decided yet'], ['school', 'Provided by the school'], ['lease', 'Rented, with a lease'], ['host', 'Free, with a host'], ['hotel', 'Hotel or short-term rental']])}</select></label></div></fieldset>
  <div><button class="btn primary" data-act="create">Create applicant and generate checklist</button></div></form></main>`;
}

function itemHtml(a, def, st, obsolete) {
  const cur = st.docs[0], older = st.docs.slice(1);
  const isStep = def.kind === 'step';
  const fee = a.cl.fee;
  const feeText = `Standard €${fee.standard}, extended €${fee.extended} at age ${fee.ageYears}.${fee.amount !== null ? ` Booked as ${a.vfsType}: €${fee.amount}.` : ''}`;
  const pts = def.reviewPoints;
  return `<li class="item${obsolete ? ' obsolete' : ''}" data-code="${def.code}">
  <div class="item-head"><span class="mono muted">${def.code}</span><h3>${esc(def.title.en)}</h3>${chip(st.status)}${!def.mandatory ? '<span class="chip plain">Optional</span>' : ''}${def.provider === 'agent' ? '<span class="chip plain">Done by agent</span>' : ''}</div>
  ${def.help.en ? `<p class="muted small">${esc(def.help.en)}</p>` : ''}${isStep ? `<p class="small">${esc(feeText)}</p>` : ''}
  ${obsolete ? '<p class="small">No longer required with the current details, but it has a file or a decision on it, so it is kept.</p>' : ''}
  ${st.status === 'rejected' && st.reason ? `<p class="notice blocker small">Rejected: ${esc(st.reason)}</p>` : ''}
  ${cur ? `<div class="row small"><strong>${esc(cur.name)}</strong><span class="muted">version ${cur.ver}, ${kb(cur.size)}, uploaded ${cur.at} by ${cur.by === 'student' ? 'the student' : esc(cur.by) + ' (agent)'}</span><a data-act="preview" data-code="${def.code}">Preview</a><a data-act="preview" data-code="${def.code}">Download</a></div>` : ''}
  ${st.status === 'pending' && cur ? `<div class="stack">${pts.length ? `<ul class="points">${pts.map((p, i) => `<li><label class="check"><input type="checkbox" class="pt" data-i="${i}"${st.checked.includes(i) ? ' checked' : ''}><span>${esc(p.en)}</span></label></li>`).join('')}</ul>` : ''}<div class="reject-form"><button class="btn small primary" data-act="approve" data-code="${def.code}">Approve</button><input class="reason" placeholder="Reason, if rejecting" aria-label="Reason for rejecting"><button class="btn small" data-act="reject" data-code="${def.code}">Reject</button></div></div>` : ''}
  ${st.status === 'approved' && !isStep ? `<div class="reject-form"><input class="reason" placeholder="Reason, to reopen as rejected" aria-label="Reason"><button class="btn small quiet" data-act="reject" data-code="${def.code}">Reject after all</button></div>` : ''}
  ${isStep ? `<div><button class="btn small" data-act="paid" data-code="${def.code}">${st.status === 'approved' ? 'Mark as not paid' : 'Mark as paid'}</button></div>` : `<div class="row"><button class="btn small quiet" data-act="physreq" data-code="${def.code}">${st.physReq ? 'No physical copy needed' : 'Needs a physical copy'}</button>${st.physReq ? `<button class="btn small quiet" data-act="physrec" data-code="${def.code}">${st.physRec ? 'Physical copy received (undo)' : 'Mark physical copy received'}</button><span class="chip ${st.physRec ? 'approved' : 'missing'}">${st.physRec ? 'Physical in office' : 'Physical outstanding'}</span>` : ''}</div>
  <details${!cur && def.provider === 'agent' ? ' open' : ''}><summary class="small">${cur ? 'Upload a replacement for the student' : 'Upload a file for the student'}</summary><div class="reject-form" style="margin-top:8px"><input type="file" class="up" data-code="${def.code}" data-by="agent" accept=".pdf,.jpg,.jpeg,.png"><button class="btn small" data-act="sample" data-code="${def.code}" data-by="agent">Use a sample file</button></div></details>`}
  ${older.length ? `<details><summary class="small">Earlier versions (${older.length})</summary><ul class="history">${older.map((d) => `<li>Version ${d.ver}: ${esc(d.name)}, ${d.at}</li>`).join('')}</ul></details>` : ''}</li>`;
}

function viewWork() {
  const a = cur(); const cl = a.cl; const r = readiness(a); const d = cl.deadlines;
  const live = liveItems(a); const codes = liveCodes(a);
  const kept = Object.entries(a.items).filter(([c]) => !codes.has(c)).map(([c, st]) => ({ def: reqOf(c), st }));
  const s = a.stage;
  const next = s === 'collecting' ? `<button class="btn primary" data-act="stage" data-s="ready"${r.readyForSubmission ? '' : ' disabled'}>Mark ready for submission</button>${r.readyForSubmission ? '' : '<p class="small muted">Every mandatory item has to be approved first.</p>'}`
    : s === 'ready' ? `<button class="btn primary" data-act="go" data-v="vfs">Open the VFS bundle</button><button class="btn" data-act="stage" data-s="submitted"${r.readyForVfs ? '' : ' disabled'}>Record as submitted</button>${r.readyForVfs ? '' : '<p class="small muted">Tick every physical document in the VFS bundle first.</p>'}`
    : s === 'submitted' ? `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-act="stage" data-s="approved">Visa approved</button><button class="btn small" data-act="stage" data-s="rejected">Visa rejected</button><button class="btn small" data-act="stage" data-s="action_required">Action required</button></div>`
    : s === 'action_required' ? `<button class="btn" data-act="stage" data-s="collecting">Back to collecting</button>` : `<p class="small">Final status recorded.</p>`;
  return `<main class="shell"><div class="page-head"><div><p class="label"><a data-act="go" data-v="list">Applicants</a> / ${a.agent}</p><h1 style="margin-top:8px">${esc(fullName(a))}</h1><p>${esc(a.email)}</p></div>${chip('pending', STAGES[a.stage])}</div>
  <div class="workspace"><div>${cl.warnings.length ? `<div class="notices">${cl.warnings.map((w) => `<p class="notice ${w.severity}">${esc(w.message)}</p>`).join('')}</div>` : ''}
  <h2>Checklist</h2><p class="muted small" style="margin:8px 0 16px">${esc(T.source)}. ${r.approved} of ${r.total} items approved${r.pending ? ', ' + r.pending + ' waiting for you' : ''}.</p>
  <ul class="items">${live.map(({ def, st }) => itemHtml(a, def, st, false)).join('')}</ul>
  ${kept.length ? `<h2 style="margin-top:32px">Kept from earlier details</h2><ul class="items">${kept.map(({ def, st }) => itemHtml(a, def, st, true)).join('')}</ul>` : ''}</div>
  <aside class="side"><section><span class="label">Next step</span>${next}<a class="small" data-act="go" data-v="vfs">VFS bundle</a></section>
  <section><span class="label">Student upload link</span><div style="display:grid;gap:8px"><button class="btn" data-act="link">${a.linkUrl ? 'Replace the upload link' : 'Create upload link'}</button>${a.linkUrl ? `<p class="linkbox">${esc(a.linkUrl)}</p><p class="small muted">Valid for 14 days. Only a hash is stored, so the link is shown once.</p><button class="btn small primary" data-act="portal">Open it as the student</button><button class="btn small quiet" data-act="revoke">Cancel the active link</button>` : ''}</div></section>
  <section><span class="label">Dates</span><dl><dt>Course starts</dt><dd>${a.start || 'Not set'}</dd><dt>Book VFS by</dt><dd>${d.vfsLatestDate || 'Needs course start'}</dd><dt>VFS booked</dt><dd>${a.vfsDate || 'Not yet'}</dd><dt>Arrive from</dt><dd>${d.earliestEntryDate || 'Needs course start'}</dd><dt>Passport until</dt><dd>${a.pExp || 'Not set'}${d.passportValidUntil ? ` (needs ${d.passportValidUntil})` : ''}</dd></dl></section>
  <section><span class="label">VFS appointment</span><div class="grid-2" style="gap:8px"><input type="date" id="vfsd" value="${a.vfsDate || ''}"><select id="vfst"><option value="">Not booked</option><option value="standard"${a.vfsType === 'standard' ? ' selected' : ''}>Standard</option><option value="extended"${a.vfsType === 'extended' ? ' selected' : ''}>Extended</option></select></div><button class="btn small" data-act="vfsset">Save appointment</button><p class="small muted">Visa fee at age ${cl.fee.ageYears}: €${cl.fee.standard} standard, €${cl.fee.extended} extended${cl.fee.amount !== null ? '. Booked: €' + cl.fee.amount : ''}.</p></section>
  <section><details><summary>Edit details and see the checklist change</summary><div class="stack" style="margin-top:12px">
  <label class="field"><span>Who pays</span><select id="e-funding"><option value="">Not set</option><option value="self"${a.funding === 'self' ? ' selected' : ''}>The student</option><option value="sponsored"${a.funding === 'sponsored' ? ' selected' : ''}>A sponsor</option></select></label>
  <label class="field"><span>MQF level</span><input id="e-mqf" type="number" min="1" max="8" value="${a.mqf || ''}"></label>
  <label class="field"><span>Course length in months</span><input id="e-months" type="number" min="1" value="${a.months || ''}"></label>
  <label class="field"><span>Accommodation</span><select id="e-acc"><option value="">Not decided</option>${[['school', 'School'], ['lease', 'Lease'], ['host', 'Host'], ['hotel', 'Hotel or short-term']].map(([k, l]) => `<option value="${k}"${a.acc === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="check"><input type="checkbox" id="e-sec"${a.hostSec ? ' checked' : ''}><span>Host’s home is a secondary address</span></label>
  <label class="field"><span>Date of birth</span><input id="e-dob" type="date" value="${a.dob}"></label>
  <button class="btn small primary" data-act="edit">Save and update the checklist</button></div></details></section>
  <section><span class="label">Demo shortcuts</span><p class="small muted">Only in this demo, to move faster.</p><button class="btn small" data-act="autoupload">Student uploads everything</button><button class="btn small" data-act="autoapprove">Approve everything uploaded</button></section>
  <section><span class="label">Recent activity</span><ul class="history" style="margin:0;padding-left:18px">${a.log.slice(0, 8).map((l) => `<li>${l.at}, ${esc(l.who)}: ${esc(l.what)}</li>`).join('')}</ul></section></aside></div></main>`;
}

function viewVfs() {
  const a = cur(); const r = readiness(a);
  const live = liveItems(a).filter(({ def }) => def.kind === 'document');
  const phys = live.filter(({ st }) => st.physReq), dig = live.filter(({ st }) => !st.physReq);
  const notOk = live.filter(({ def, st }) => def.mandatory && st.status !== 'approved');
  const fee = a.cl.fee;
  const ds = (s) => (s === 'approved' ? 'approved' : s === 'missing' ? 'missing' : s === 'pending' ? 'waiting for review' : 'rejected');
  return `<main class="shell" style="max-width:820px"><div class="page-head"><div><p class="label"><a data-act="open" data-id="${a.id}">${esc(fullName(a))}</a> / VFS bundle</p><h1 style="margin-top:8px">Take to VFS</h1><p>${a.vfsDate ? 'Appointment on ' + a.vfsDate + ', ' + a.vfsType : 'No appointment booked yet'}. ${fee.amount !== null ? 'Fee to pay by card: €' + fee.amount + '.' : 'Fee to pay by card: €' + fee.standard + ' standard or €' + fee.extended + ' extended.'}</p></div>${chip(r.readyForVfs ? 'approved' : 'missing', r.readyForVfs ? 'Complete' : 'Not complete')}</div>
  ${notOk.length ? `<div class="notices">${notOk.map(({ def, st }) => `<p class="notice blocker">${esc(def.title.en)} is ${st.status === 'missing' ? 'still missing' : st.status === 'pending' ? 'waiting for review' : 'rejected'}.</p>`).join('')}</div>` : ''}
  <h2>Physical documents (${phys.filter(({ st }) => st.physRec).length} of ${phys.length} in the office)</h2><ul class="bundle items" style="margin-top:12px">${phys.map(({ def, st }) => `<li><span class="box${st.physRec ? ' on' : ''}"></span><span style="flex:1">${esc(def.title.en)}<span class="muted small"> (${st.physRec ? 'in the office' : 'not received'}, digital copy ${ds(st.status)})</span></span><button class="btn small quiet" data-act="physrec" data-code="${def.code}">${st.physRec ? 'Undo' : 'Mark received'}</button></li>`).join('') || '<li class="muted">No physical documents are flagged.</li>'}</ul>
  <h2 style="margin-top:40px">Digital only</h2><ul class="bundle items" style="margin-top:12px">${dig.map(({ def, st }) => `<li><span class="box${st.status === 'approved' ? ' on' : ''}"></span><span style="flex:1">${esc(def.title.en)}</span>${chip(st.status)}</li>`).join('')}</ul>
  <p style="margin-top:32px"><button class="btn" data-act="open" data-id="${a.id}">Back to the applicant</button></p></main>`;
}

function viewPortal() {
  const a = cur(); const lang = S.lang || a.lang; const t = PT[lang];
  const items = liveItems(a).filter(({ def }) => def.provider === 'student' && def.kind === 'document');
  const mand = items.filter(({ def }) => def.mandatory); const done = mand.filter(({ st }) => st.status === 'approved').length;
  const allUp = mand.every(({ st }) => st.status !== 'missing' && st.status !== 'rejected');
  const msg = S.pmsg ? `<p class="${S.pmsg === 'sent' ? 'notice' : 'error'}" role="status" style="margin-bottom:24px">${t[S.pmsg === 'sent' ? 'sent' : S.pmsg]}</p>` : '';
  return `<div class="demo-bar"><span>You are seeing what the student sees.</span><button class="btn small" data-act="open" data-id="${a.id}">Back to the agent view</button></div>
  <div class="portal"><div class="portal-head"><span class="brand">Admissions and visas</span><nav class="lang"><a data-act="lang" data-l="en" aria-current="${lang === 'en'}">English</a><a data-act="lang" data-l="fr" aria-current="${lang === 'fr'}">Français</a></nav></div>
  <h1>${esc(t.hello(a.first))}</h1><p class="muted" style="margin-top:12px">${t.intro}</p><div class="progress"><i style="width:${mand.length ? (done / mand.length) * 100 : 0}%"></i></div><p class="small muted" style="margin-top:-16px;margin-bottom:24px">${t.progress(done, mand.length)}</p>
  ${msg}${allUp && mand.length ? `<p class="notice" style="margin-bottom:24px">${t.allDone}</p>` : ''}
  <section style="margin-bottom:24px"><span class="label">${t.notes}</span><ul style="margin:8px 0 0;padding-left:18px">${T.generalNotes.map((n) => `<li>${esc(n[lang])}</li>`).join('')}</ul></section>
  <ul class="items">${items.map(({ def, st }) => { const c = st.docs[0]; return `<li class="item" data-code="${def.code}"><div class="item-head"><h3>${esc(def.title[lang])}</h3>${chip(st.status, t[st.status])}</div>${def.help[lang] ? `<p class="muted small">${esc(def.help[lang])}</p>` : ''}${!def.mandatory ? `<p class="small muted">${t.optional}</p>` : ''}${st.status === 'rejected' && st.reason ? `<p class="notice blocker small"><strong>${t.reason}:</strong> ${esc(st.reason)}</p>` : ''}${c ? `<p class="small muted">${esc(c.name)}, ${t.uploadedOn} ${c.at.slice(0, 10)}</p>` : ''}${st.status !== 'approved' ? `<div class="reject-form"><input type="file" class="up" data-code="${def.code}" data-by="student" accept=".pdf,.jpg,.jpeg,.png" aria-label="${t.choose}"><button class="btn small" data-act="sample" data-code="${def.code}" data-by="student">${lang === 'fr' ? 'Fichier d’exemple' : 'Use a sample file'}</button></div><p class="small muted">${t.formats}</p>` : ''}</li>`; }).join('')}</ul></div>`;
}

/* ---------- render ---------- */
function render() {
  const app = document.getElementById('app');
  const keep = document.activeElement && document.activeElement.id === 'q' ? document.activeElement.selectionStart : null;
  let body = '';
  if (S.view === 'portal') body = switcher() + viewPortal();
  else body = switcher() + topBar() + guide() + (S.view === 'list' ? viewList() : S.view === 'new' ? viewNew() : S.view === 'work' ? viewWork() : viewVfs());
  app.innerHTML = body + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '') + (S.modal ? modal() : '');
  if (keep !== null) { const q = document.getElementById('q'); q.focus(); q.setSelectionRange(keep, keep); }
}
function modal() {
  const a = cur(); const st = a.items[S.modal]; const d = st.docs[0]; const def = reqOf(S.modal);
  return `<div class="modal" data-act="closemodal"><div class="sheet"><div class="row" style="justify-content:space-between;display:flex"><strong>${esc(d.name)}</strong><button class="btn small" data-act="closemodal">Close</button></div><p class="small muted">${esc(def.title.en)}, version ${d.ver}, ${kb(d.size)}. In the real app the file opens here through a link that expires after 60 seconds, and the view is written to the audit log.</p><div class="page"><i></i><i></i><i></i><i></i><i></i><i style="width:55%"></i></div></div></div>`;
}

/* ---------- upload handling ---------- */
function accept(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return 'errType';
  if (file.size > 10 * 1048576) return 'errBig';
  if (file.size === 0) return 'errEmpty';
  return null;
}
function doUpload(a, code, by, name, size) {
  const st = a.items[code];
  addDoc(st, name, size, by === 'student' ? 'student' : 'Sara');
  if (by === 'student') { a.flags.student = true; log(a, 'student', 'document.uploaded_by_student'); S.pmsg = 'sent'; }
  else log(a, 'Sara', 'document.uploaded_by_agent');
}

/* ---------- events ---------- */
const val = (id) => document.getElementById(id)?.value ?? '';
const SAMPLE = { first: 'Nadia', last: 'Alaoui', dob: '2002-06-18', email: 'nadia.a@example.com', lang: 'fr', pass: 'XD9988776', pExp: '2031-09-01', inst: 'Sample College of Business', course: 'Diploma in Business Management', mqf: '5', start: addD(TODAY, 100), months: '12', funding: 'sponsored', acc: 'lease' };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act; const a = cur(); const code = el.dataset.code;
  if (act === 'go') { if (el.dataset.v === 'vfs') { a.flags.vfs = true; } if (el.dataset.v === 'new') S.form = null; S.err = ''; return go(el.dataset.v); }
  if (act === 'open') return go('work', +el.dataset.id);
  if (act === 'jump') {
    const v = el.dataset.v;
    if (v === 'list') return go('list');
    if (!S.cur) S.cur = S.apps[0].id;
    if (v === 'portal') { S.pmsg = ''; S.view = 'portal'; S.lang = null; render(); window.scrollTo(0, 0); return; }
    if (v === 'vfs') cur().flags.vfs = true;
    return go(v, S.cur);
  }
  if (act === 'reset') { init(); return; }
  if (act === 'closemodal') { if (el.classList.contains('modal') && e.target !== el) return; S.modal = null; return render(); }
  if (act === 'preview') { S.modal = code; log(a, 'Sara', 'document.viewed'); return render(); }
  if (act === 'fill') { S.form = { ...SAMPLE }; return render(); }
  if (act === 'lang') { S.lang = el.dataset.l; S.pmsg = ''; return render(); }
  if (act === 'portal') { S.pmsg = ''; S.view = 'portal'; S.lang = null; render(); window.scrollTo(0, 0); return; }
  if (act === 'create') {
    const f = Object.fromEntries(new FormData(document.getElementById('newform')).entries());
    S.form = f; S.err = '';
    if (!f.first || !f.last || !f.dob || !f.email) { S.err = 'First name, last name, date of birth and email are required.'; return render(); }
    const age = Math.floor((new Date(TODAY) - new Date(f.dob)) / 31557600000);
    if (age < 18 && !f.parentEmail) { S.err = 'The applicant is under 18. Add a parent or guardian email.'; return render(); }
    const dups = S.apps.filter((x) => (f.pass && x.pass && x.pass.toLowerCase() === f.pass.toLowerCase()) || (x.first.toLowerCase() === f.first.toLowerCase() && x.last.toLowerCase() === f.last.toLowerCase() && x.dob === f.dob));
    if (dups.length && !document.getElementById('confirmdup')?.checked) { S.dup = dups; return render(); }
    const n = makeApp({ agent: 'Sara', first: f.first, last: f.last, dob: f.dob, email: f.email, lang: f.lang || 'en', parentName: f.parentName, parentEmail: f.parentEmail, pass: f.pass, pExp: f.pExp, inst: f.inst, course: f.course, mqf: f.mqf, start: f.start, months: f.months, funding: f.funding, acc: f.acc });
    S.apps.push(n); S.form = null; return go('work', n.id);
  }
  if (!a) return;
  if (act === 'link') { a.linkUrl = 'https://visa.example.com/u/' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 14); a.linkLive = true; a.flags.link = true; log(a, 'Sara', 'upload_link.created'); return render(); }
  if (act === 'revoke') { a.linkUrl = null; a.linkLive = false; log(a, 'Sara', 'upload_link.revoked'); return render(); }
  if (act === 'sample') { const by = el.dataset.by; doUpload(a, code, by, `${code}-sample.pdf`, 180000 + Math.floor(Math.random() * 400000), true); if (by === 'student') S.view = 'portal'; return render(); }
  if (act === 'approve') {
    const item = el.closest('.item'); const st = a.items[code]; const pts = reqOf(code).reviewPoints;
    const checked = [...item.querySelectorAll('.pt')].filter((c) => c.checked).length;
    if (checked < pts.length) return toast('Tick every review point before approving, or reject the document with a reason.');
    st.status = 'approved'; st.reason = ''; st.checked = pts.map((_, i) => i); a.flags.reviewed = true; log(a, 'Sara', 'document.approved'); return render();
  }
  if (act === 'reject') {
    const reason = el.closest('.item').querySelector('.reason').value.trim();
    if (!reason) return toast('Give a reason when rejecting, so the student knows what to fix.');
    const st = a.items[code]; st.status = 'rejected'; st.reason = reason; a.flags.reviewed = true; log(a, 'Sara', 'document.rejected'); return render();
  }
  if (act === 'paid') { const st = a.items[code]; st.status = st.status === 'approved' ? 'missing' : 'approved'; log(a, 'Sara', st.status === 'approved' ? 'step.done' : 'step.reopened'); return render(); }
  if (act === 'physreq') { const st = a.items[code]; st.physReq = !st.physReq; if (!st.physReq) st.physRec = false; return render(); }
  if (act === 'physrec') { const st = a.items[code]; st.physRec = !st.physRec; log(a, 'Sara', 'physical.updated'); return render(); }
  if (act === 'stage') { a.stage = el.dataset.s; log(a, 'Sara', 'stage.changed: ' + a.stage); return render(); }
  if (act === 'vfsset') { a.vfsDate = val('vfsd') || null; a.vfsType = val('vfst') || null; sync(a); log(a, 'Sara', 'applicant.updated'); return render(); }
  if (act === 'edit') {
    a.funding = val('e-funding'); a.mqf = val('e-mqf'); a.months = val('e-months'); a.acc = val('e-acc'); a.hostSec = document.getElementById('e-sec').checked; a.dob = val('e-dob') || a.dob;
    sync(a); log(a, 'Sara', 'applicant.updated'); return toast('Checklist updated: ' + a.cl.items.length + ' items now apply.');
  }
  if (act === 'autoupload') { let n = 0; for (const { def, st } of liveItems(a)) if (def.provider === 'student' && def.kind === 'document' && (st.status === 'missing' || st.status === 'rejected')) { doUpload(a, def.code, 'student', `${def.code}-scan.pdf`, 200000 + Math.floor(Math.random() * 500000)); n++; } S.pmsg = ''; return toast(n + ' documents uploaded as the student.'); }
  if (act === 'autoapprove') { let n = 0; for (const { def, st } of liveItems(a)) if (st.status === 'pending') { st.status = 'approved'; st.checked = def.reviewPoints.map((_, i) => i); n++; } if (n) { a.flags.reviewed = true; log(a, 'Sara', 'demo shortcut: approved ' + n); } return toast(n + ' documents approved.'); }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'stagef') { S.stage = t.value; return render(); }
  if (t.classList.contains('pt')) { const code = t.closest('.item').dataset.code; const st = cur().items[code]; const i = +t.dataset.i; st.checked = t.checked ? [...new Set([...st.checked, i])] : st.checked.filter((x) => x !== i); return; }
  if (t.classList.contains('up') && t.files[0]) {
    const file = t.files[0]; const a = cur(); const by = t.dataset.by; const err = accept(file);
    if (err) { if (by === 'student') { S.pmsg = err; return render(); } return toast({ errType: 'Only PDF, JPG and PNG files are accepted.', errBig: 'The file is larger than 10 MB.', errEmpty: 'Choose a file to upload.' }[err]); }
    doUpload(a, t.dataset.code, by, file.name, file.size); render();
  }
});
document.addEventListener('input', (e) => { if (e.target.id === 'q') { S.q = e.target.value; render(); } });
init();
