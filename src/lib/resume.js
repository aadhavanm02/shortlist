// Resume data model + helpers.
// {
//   name, title, phone, email, links: [{ label, url }],
//   summary,
//   experience: [{ role, company, dates, location?, bullets: [{ label, text }] }],
//   projects:   [{ name, bullets: [{ label, text }] }],
//   education:  [{ school, degree, dates }],
//   skills:     [{ label, items }],
//   skillsLink: { label, url } | null,
//   template: 'studio' | 'classic',   // the person's own resume design
//   emailUrl, location                  // where the email text links to; city shown in the classic header
// }
// The header (name, title, contact, links), education and projects are fixed to the master resume.
// Only the summary, experience bullets and skills are ever changed by the AI or by tailoring.

export const EMPTY_RESUME = {
  name: '', title: '', phone: '', email: '', links: [], summary: '',
  experience: [], projects: [], education: [], skills: [], skillsLink: null,
  template: 'studio', emailUrl: '', location: '',
};

export const LOCKED = ['name', 'title', 'phone', 'email', 'emailUrl', 'location', 'links', 'skillsLink', 'template', 'education', 'projects'];

// Keep the master's header and fixed sections on any tailored copy
export function lockHeader(r, master) {
  if (!r || !master) return r;
  const m = normalizeResume(master); const out = { ...normalizeResume(r) };
  LOCKED.forEach((k) => { out[k] = structuredClone(m[k]); });
  return out;
}

export function normalizeResume(r) {
  const out = { ...EMPTY_RESUME, ...(r || {}) };
  const email = (out.email || '').toLowerCase();
  out.links = (out.links || []).filter((l) => l && l.url).map((l) => ({ label: l.label || 'Link', url: l.url }));
  // An email link is the email itself, not an extra header link
  out.links = out.links.filter((l) => {
    const u = l.url.toLowerCase();
    const isMail = u.startsWith('mailto:') || /mail\.google\.com/.test(u) || (email && u.includes(email)) || /^(e-?mail|gmail)$/i.test(l.label.trim());
    if (isMail && !out.emailUrl && !u.startsWith('mailto:')) out.emailUrl = l.url;
    return !isMail;
  });
  // A "proof of skills" link belongs next to the Skills heading
  const proof = out.links.find((l) => /skill/i.test(l.label) || /\/skills\/?$/i.test(l.url));
  if (proof) { if (!out.skillsLink?.url) out.skillsLink = proof; out.links = out.links.filter((l) => l !== proof); }
  if (out.skillsLink && !out.skillsLink.url) out.skillsLink = null;
  out.template = out.template === 'classic' ? 'classic' : 'studio';
  out.experience = (out.experience || []).map((e) => ({ role: e.role || '', company: e.company || '', dates: e.dates || '', bullets: (e.bullets || []).map(nb) }));
  out.projects = (out.projects || []).map((p) => ({ name: p.name || '', bullets: (p.bullets || []).map(nb) }));
  out.education = (out.education || []).map((e) => ({ school: e.school || '', degree: e.degree || '', dates: e.dates || '' }));
  out.skills = (out.skills || []).map((s) => ({ label: s.label || '', items: Array.isArray(s.items) ? s.items.join(', ') : (s.items || '') }));
  return out;
}
function nb(b) { return typeof b === 'string' ? { label: '', text: b } : { label: b.label || '', text: b.text || '' }; }

// path like "experience.0.bullets.1.text"
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[isNaN(k) ? k : Number(k)]), obj);
}
export function setPath(obj, path, value) {
  const copy = structuredClone(obj);
  const keys = path.split('.');
  let o = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = isNaN(keys[i]) ? keys[i] : Number(keys[i]);
    if (o[k] == null) return copy;
    o = o[k];
  }
  const last = keys[keys.length - 1];
  o[isNaN(last) ? last : Number(last)] = value;
  return copy;
}
// Only these parts can change: summary, experience bullet text, skills items
export const EDITABLE = /^(summary|experience\.\d+\.bullets\.\d+\.text|skills\.\d+\.items)$/;
export function validPath(obj, path) {
  if (typeof path !== 'string' || !EDITABLE.test(path)) return false;
  const v = getPath(obj, path);
  return typeof v === 'string';
}

export function pathLabel(r, path) {
  const k = path.split('.');
  if (k[0] === 'summary') return 'Summary';
  if (k[0] === 'title') return 'Title';
  if (k[0] === 'experience') {
    const e = r.experience[+k[1]]; const b = e?.bullets?.[+k[3]];
    return `${e?.company || 'Experience'}${b?.label ? ' · ' + b.label : ''}`;
  }
  if (k[0] === 'projects') { const p = r.projects[+k[1]]; return `Project · ${p?.name || ''}`; }
  if (k[0] === 'skills') { const s = r.skills[+k[1]]; return `Skills · ${s?.label || ''}`; }
  if (k[0] === 'education') return 'Education';
  return path;
}

// Every editable text field with its path, used to give the AI addressable lines
export function lines(r) {
  const out = [];
  out.push(['summary', r.summary]);
  r.experience.forEach((e, i) => e.bullets.forEach((b, j) => out.push([`experience.${i}.bullets.${j}.text`, (b.label ? b.label + ': ' : '') + b.text])));
  r.skills.forEach((s, i) => out.push([`skills.${i}.items`, s.label ? `${s.label}: ${s.items}` : s.items]));
  return out;
}

export function resumeText(r) {
  const parts = [r.name, r.title, r.summary];
  r.experience.forEach((e) => { parts.push(`${e.role} at ${e.company} (${e.dates})`); e.bullets.forEach((b) => parts.push(`${b.label} ${b.text}`)); });
  r.projects.forEach((p) => { parts.push(p.name); p.bullets.forEach((b) => parts.push(`${b.label} ${b.text}`)); });
  r.skills.forEach((s) => parts.push(s.label ? `${s.label}: ${s.items}` : s.items));
  r.education.forEach((e) => parts.push(`${e.degree} ${e.school}`));
  return parts.filter(Boolean).join('\n').replace(/\*\*/g, '');
}

const STOP = new Set('and or the a an of to in for with on at by from as is are be this that your you our we will using use etc years year experience work working team teams strong good skills ability'.split(' '));
export function keywords(text) {
  const t = (text || '').toLowerCase().replace(/\*\*/g, '');
  const words = t.match(/[a-z][a-z0-9+#./-]{1,}/g) || [];
  return words.filter((w) => !STOP.has(w) && w.length > 2);
}

// Skill phrases from the skills section, used for matching against JDs
export function skillPhrases(r) {
  const set = new Set();
  r.skills.forEach((s) => s.items.split(/[,;]/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).forEach((x) => set.add(x)));
  return [...set];
}

// **bold** markup -> segments
export function segments(text) {
  const out = []; const re = /\*\*(.+?)\*\*/g; let last = 0; let m;
  const t = text || '';
  while ((m = re.exec(t))) { if (m.index > last) out.push({ t: t.slice(last, m.index), b: false }); out.push({ t: m[1], b: true }); last = re.lastIndex; }
  if (last < t.length) out.push({ t: t.slice(last), b: false });
  return out;
}

export function stripDashes(s) {
  // the user prefers no em dashes in drafted content
  return (s || '').replace(/\s*—\s*/g, ', ');
}
