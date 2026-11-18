// Job sources: JSearch (Google for Jobs via RapidAPI) and Adzuna, called through the Shortlist
// Worker, which holds the keys. Fetched once a day on first open; refresh is manual.
import { getState, updateProfile, today } from './store.js';
import { API, getStatus } from './api.js';
import { resumeText, keywords, skillPhrases } from './resume.js';

const INR_YEAR = (n) => Math.round((n / 100000) * 10) / 10; // rupees -> lakhs

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); }
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function detectMode(text, remoteFlag) {
  if (remoteFlag) return 'Remote';
  const t = (text || '').toLowerCase();
  if (/\bhybrid\b/.test(t)) return 'Hybrid';
  if (/\b(work from home|wfh|fully remote|remote[- ]first|100% remote)\b/.test(t)) return 'Remote';
  return 'Office';
}

export function parseExperience(text) {
  const t = (text || '').replace(/–|—/g, '-');
  const m = t.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to)\s*(\d{1,2})\s*(?:\+)?\s*(?:years|yrs|year)/i) || t.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)/i);
  if (!m) return null;
  const min = +m[1]; const max = m[2] ? +m[2] : null;
  if (min > 25) return null;
  return { min, max };
}

function extractEmails(text) {
  const found = (text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => !/noreply|no-reply|example\./.test(e)).slice(0, 3);
}

function salaryText(min, max) {
  if (!min && !max) return '';
  if (min && max && min !== max) return `₹${min}–${max} LPA`;
  return `₹${min || max} LPA`;
}

async function jsearch(query, signal) {
  const url = `${API}/jsearch?query=${encodeURIComponent(query)}&page=1&num_pages=1&country=in&date_posted=3days`;
  let res;
  try { res = await fetch(url, { signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Could not reach JSearch'); }
  if (res.status === 429) throw new Error('JSearch monthly limit reached');
  if (res.status === 401 || res.status === 403) throw new Error('JSearch key was rejected');
  if (!res.ok) throw new Error(`JSearch error ${res.status}`);
  const data = await res.json();
  // search-v2 returns { data: { jobs, cursor } }; the old /search returned { data: [...] }
  const list = Array.isArray(data.data) ? data.data : (data.data?.jobs || []);
  return list.map((j) => {
    let smin = null, smax = null;
    if (j.job_salary_currency === 'INR' || !j.job_salary_currency) {
      const f = j.job_salary_period === 'MONTH' ? 12 : j.job_salary_period === 'YEAR' ? 1 : 0;
      if (f && j.job_min_salary) smin = INR_YEAR(j.job_min_salary * f);
      if (f && j.job_max_salary) smax = INR_YEAR(j.job_max_salary * f);
    }
    const desc = j.job_description || '';
    return {
      title: j.job_title, company: j.employer_name || 'Company', location: [j.job_city, j.job_state].filter(Boolean).join(', ') || (j.job_is_remote ? 'Remote' : 'India'),
      mode: detectMode(desc, j.job_is_remote), salMin: smin, salMax: smax, description: desc,
      url: j.job_apply_link || j.job_google_link, posted: j.job_posted_at_datetime_utc || null,
      source: j.job_publisher || 'Google Jobs', alsoOn: (j.apply_options || []).map((o) => o.publisher).filter(Boolean).slice(0, 4),
      exp: j.job_required_experience?.required_experience_in_months ? { min: Math.round(j.job_required_experience.required_experience_in_months / 12), max: null } : parseExperience(desc),
    };
  });
}

async function adzuna(what, where, signal) {
  const params = new URLSearchParams({ results_per_page: '20', what_phrase: what, max_days_old: '3', 'content-type': 'application/json' });
  if (where) params.set('where', where);
  let res;
  try { res = await fetch(`${API}/adzuna?${params}`, { signal }); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Could not reach Adzuna');
  }
  if (res.status === 401 || res.status === 403) throw new Error('Adzuna keys were rejected');
  if (res.status === 429) throw new Error('Adzuna daily limit reached');
  if (!res.ok) throw new Error(`Adzuna error ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((j) => {
    const desc = (j.description || '').replace(/<[^>]+>/g, '');
    return {
      title: (j.title || '').replace(/<[^>]+>/g, ''), company: j.company?.display_name || 'Company', location: j.location?.display_name || where || 'India',
      mode: detectMode(desc), salMin: j.salary_min ? INR_YEAR(j.salary_min) : null, salMax: j.salary_max ? INR_YEAR(j.salary_max) : null,
      description: desc, url: j.redirect_url, posted: j.created || null, source: 'Adzuna', alsoOn: [], exp: parseExperience(desc), short: true,
    };
  });
}

function ago(iso) {
  if (!iso) return '';
  const h = Math.max(0, Math.round((Date.now() - new Date(iso)) / 3600000));
  if (h < 1) return 'just now'; if (h < 24) return `${h}h ago`; const d = Math.round(h / 24); return `${d}d ago`;
}

function scoreJob(job, prefs, resume, skillList) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const titleN = norm(job.title);
  let s = 40;
  // title match is the strongest signal
  const titleHit = prefs.titles.some((t) => titleN.includes(norm(t)));
  const titleWords = prefs.titles.some((t) => norm(t).split(' ').filter((w) => w.length > 3).every((w) => titleN.includes(w)));
  if (titleHit) s += 30; else if (titleWords) s += 20;
  // skills overlap
  const matched = skillList.filter((k) => k.length > 2 && text.includes(k.toLowerCase()));
  s += Math.min(25, matched.length * 3);
  // resume keyword overlap
  const rk = new Set(keywords(resumeText(resume)));
  const jk = [...new Set(keywords(job.description))];
  const overlap = jk.filter((w) => rk.has(w)).length;
  s += Math.min(10, Math.round(overlap / 6));
  if (prefs.companies.some((c) => norm(job.company).includes(norm(c)))) s += 5;
  return { score: Math.min(99, s), matched: matched.slice(0, 10) };
}

function passes(job, prefs) {
  const reasons = [];
  const mode = job.mode.toLowerCase();
  if ((mode === 'office' && !prefs.work.office) || (mode === 'hybrid' && !prefs.work.hybrid) || (mode === 'remote' && !prefs.work.remote)) reasons.push('work type');
  const salMin = parseFloat(prefs.salMin);
  if (job.salMax || job.salMin) {
    if (salMin && (job.salMax || job.salMin) < salMin) reasons.push('salary');
  } else if (!prefs.includeNoSalary) reasons.push('no salary shown');
  const eMax = parseFloat(prefs.expMax); const eMin = parseFloat(prefs.expMin);
  if (job.exp?.min != null && eMax && job.exp.min > eMax) reasons.push('experience');
  if (job.exp?.max != null && eMin && job.exp.max < eMin) reasons.push('experience');
  if (prefs.cities.length && mode !== 'remote') {
    const loc = norm(job.location);
    if (!prefs.cities.some((c) => loc.includes(norm(c))) && !/india/.test(loc)) reasons.push('location');
  }
  return reasons;
}

export async function fetchFeed(profileId, { force = false } = {}) {
  const p = getState().profiles[profileId];
  if (!force && p.feed?.date === today()) return p.feed;
  const prefs = p.prefs;
  if (!navigator.onLine) throw Object.assign(new Error('You are offline.'), { kind: 'offline' });
  let st;
  try { st = await getStatus(); } catch { throw Object.assign(new Error('Could not reach the Shortlist server. Try again in a minute.'), { kind: 'source' }); }
  const hasJ = !!st.jsearch; const hasA = !!st.adzuna;
  if (!hasJ && !hasA) throw Object.assign(new Error('Job search is not set up on the server yet.'), { kind: 'nokey' });

  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 45000);
  const notes = []; const raw = [];
  const cities = prefs.cities.slice(0, 3);
  const titles = prefs.titles.slice(0, 6);
  const tasks = [];
  if (hasJ) {
    // one query per city keeps JSearch under its small monthly free quota
    const q = titles.slice(0, 4).map((t) => `"${t}"`).join(' OR ');
    const places = cities.length ? cities : ['India'];
    places.forEach((c) => tasks.push(jsearch(`${q} in ${c}, India`, ctrl.signal).catch((e) => { notes.push(e.message); return []; })));
    if (prefs.work.remote) tasks.push(jsearch(`${q} remote India`, ctrl.signal).catch((e) => { notes.push(e.message); return []; }));
  }
  if (hasA) {
    const places = cities.length ? cities : [''];
    titles.forEach((t) => places.forEach((c) => tasks.push(adzuna(t, c, ctrl.signal).catch((e) => { notes.push(e.message); return []; }))));
  }
  try { (await Promise.all(tasks)).forEach((list) => raw.push(...list)); } finally { clearTimeout(timer); }
  if (!raw.length && notes.length) throw Object.assign(new Error([...new Set(notes)].join(' · ')), { kind: 'source' });

  // dedupe: same title + company is one job; remember the other sources
  const byKey = new Map();
  for (const j of raw) {
    if (!j.title) continue;
    const key = norm(j.title) + '|' + norm(j.company);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, j);
    else {
      prev.alsoOn = [...new Set([...(prev.alsoOn || []), j.source, ...(j.alsoOn || [])])].filter((s) => s !== prev.source);
      if (prev.short && !j.short) Object.assign(prev, { description: j.description, short: false, url: j.url || prev.url });
    }
  }
  const resume = p.resume;
  const skills = resume ? skillPhrases(resume) : [];
  const avoid = prefs.avoid.map(norm);
  const all = [];
  for (const j of byKey.values()) {
    const tn = norm(j.title);
    if (avoid.some((a) => a && tn.includes(a))) continue;
    const id = hash(norm(j.title) + '|' + norm(j.company));
    if (p.status[id]) continue; // already applied or skipped
    const { score, matched } = resume ? scoreJob(j, prefs, resume, skills) : { score: 50, matched: [] };
    const misses = passes(j, prefs);
    all.push({
      ...j, id, score, matched, misses, ago: ago(j.posted),
      salary: salaryText(j.salMin, j.salMax) || 'Salary not disclosed',
      expText: j.exp ? (j.exp.max ? `${j.exp.min}–${j.exp.max} yrs` : `${j.exp.min}+ yrs`) : '',
      emails: extractEmails(j.description), dream: prefs.companies.some((c) => norm(j.company).includes(norm(c))),
      short: j.short || (j.description || '').length < 600,
    });
  }
  all.sort((a, b) => b.score - a.score);
  const ok = all.filter((j) => !j.misses.length);
  const close = all.filter((j) => j.misses.length === 1).slice(0, 10);
  const feed = { date: today(), fetchedAt: Date.now(), list: ok.slice(0, p.limits.jobsPerDay), close, notes: [...new Set(notes)] };
  updateProfile(profileId, (pp) => { pp.feed = feed; });
  return feed;
}

export function setJobStatus(profileId, job, s) {
  updateProfile(profileId, (p) => {
    if (s) { p.status[job.id] = { s, at: Date.now() }; p.jobCache[job.id] = job; }
    else { delete p.status[job.id]; }
  });
}

// Skipped jobs disappear after 7 days
export function pruneSkipped(profileId) {
  const week = 7 * 86400000;
  updateProfile(profileId, (p) => {
    for (const [id, st] of Object.entries(p.status)) {
      if (st.s === 'skipped' && Date.now() - st.at > week) { delete p.status[id]; delete p.jobCache[id]; }
    }
  });
}

export function findJob(p, id) {
  return p.feed?.list.find((j) => j.id === id) || p.feed?.close.find((j) => j.id === id) || p.jobCache[id] || null;
}
