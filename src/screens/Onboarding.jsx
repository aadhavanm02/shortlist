import { useRef, useState } from 'react';
import { useStore, updateProfile } from '../lib/store.js';
import { Logo, Banner, Field, TagInput, Toggle, Icon, TopBar, useMobile, AppBar } from '../components/ui.jsx';
import { readPdf } from '../lib/pdfText.js';
import { callAI, importPrompt, AIError } from '../lib/ai.js';
import { normalizeResume } from '../lib/resume.js';

const TITLES = {
  A: ['Product Designer', 'Senior Product Designer', 'UX Designer', 'Senior UX Designer', 'UI/UX Designer', 'UX/UI Designer', 'Interaction Designer', 'Product Design Lead', 'Visual Designer', 'UX Researcher', 'Design Systems Designer', 'Staff Product Designer'],
  G: ['Business Analyst', 'Senior Business Analyst', 'Business Systems Analyst', 'Product Analyst', 'Data Analyst', 'Quality Analyst', 'Content Quality Analyst', 'Metadata Analyst', 'Functional Analyst', 'Functional Consultant', 'IT Business Analyst', 'Associate Product Owner', 'Process Analyst', 'Requirements Analyst'],
};
const CITIES = ['Chennai', 'Bangalore', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Gurgaon', 'Noida', 'Coimbatore', 'Kochi', 'Pondicherry', 'Ahmedabad', 'Kolkata'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const NOTICE = ['Immediate', '15 days', '30 days', '60 days', '90 days'];

export default function Onboarding({ pid, editing }) {
  const mobile = useMobile();
  const p = useStore((s) => s.profiles[pid]);
  const [f, setF] = useState(() => structuredClone(p.prefs));
  const [resume, setResume] = useState(p.resume);
  const [file, setFile] = useState(p.resumeFile);
  const [tried, setTried] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null); const jsonRef = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const smin = parseFloat(f.salMin), smax = parseFloat(f.salMax);
  const errs = {
    titles: f.titles.length ? null : 'Add at least one job title',
    cities: f.cities.length || f.work.remote ? null : 'Add at least one city, or choose Remote',
    work: f.work.office || f.work.hybrid || f.work.remote ? null : 'Pick at least one work type',
    salary: smin && smax && smin > smax ? "Minimum can't be more than maximum" : null,
    exp: f.expMin && f.expMax && +f.expMin > +f.expMax ? "'From' can't be more than 'Up to'" : null,
    resume: resume ? null : 'Upload your resume PDF',
  };
  const errCount = Object.values(errs).filter(Boolean).length;
  const show = (k) => (tried ? errs[k] : null);

  async function onPdf(e) {
    const fl = e.target.files?.[0]; e.target.value = '';
    if (!fl) return;
    setImporting(true); setImportMsg(null);
    try {
      const { text, links, pages } = await readPdf(fl);
      if (text.length < 300) {
        setImportMsg({ tone: 'warn', text: 'This PDF looks scanned or image based, so almost no text could be read. Upload a text based PDF, or fill in your resume by hand in Resumes after setup.' });
        setResume(normalizeResume({ name: p.name })); setFile(fl.name); return;
      }
      const { system, user } = importPrompt(text, links);
      const out = await callAI(pid, 'refine', system, user);
      const r = normalizeResume(out);
      setResume(r); setFile(fl.name);
      const nb = r.experience.reduce((n, x) => n + x.bullets.length, 0);
      const inc = (out.incomplete || []).filter(Boolean);
      setImportMsg(inc.length ? { tone: 'warn', text: `Read ${r.experience.length} roles and ${nb} bullets, but some parts look cut off: ${inc.slice(0, 2).join('; ')}. You can fix them in Resumes after setup.` }
        : { tone: 'ok', text: `Read ${plural(r.experience.length, 'role')}, ${plural(nb, 'bullet')} and ${plural(r.skills.length, 'skill group')}${pages > 1 ? ` from ${pages} pages` : ''}. Check it any time in Resumes.` });
    } catch (err) {
      setImportMsg({ tone: 'err', text: err instanceof AIError ? err.message : 'Could not read this PDF. Try another file.' });
    } finally { setImporting(false); }
  }

  async function onJson(e) {
    const fl = e.target.files?.[0]; e.target.value = '';
    if (!fl) return;
    try {
      const data = JSON.parse(await fl.text());
      const r = normalizeResume(data.resume || data);
      setResume(r); setFile(fl.name);
      if (data.prefs && !f.titles.length) setF({ ...f, ...data.prefs });
      setImportMsg({ tone: 'ok', text: `Loaded ${r.name || 'resume'} from ${fl.name}.` });
    } catch { setImportMsg({ tone: 'err', text: 'That file isn\'t a valid Shortlist resume file.' }); }
  }

  function save() {
    setTried(true);
    if (errCount) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    updateProfile(pid, (pp) => {
      const prefsChanged = JSON.stringify(pp.prefs) !== JSON.stringify(f);
      pp.prefs = f; pp.resume = resume; pp.resumeFile = file; pp.resumeUpdated = pp.resumeUpdated || Date.now(); pp.setup = true;
      if (prefsChanged) pp.feed = null; // refetch with new preferences
    });
    location.hash = '#/jobs';
  }

  const W = f.work;
  return (
    <div className="app">
      {mobile ? <AppBar back={editing ? '#/settings' : '#/'} title="Job preferences" sub={editing ? p.name : `Setting up ${p.name}`} /> : editing ? <TopBar pid={pid} route="/settings" back={{ href: '#/settings', label: 'Settings' }} /> : (
        <header className="topbar"><Logo href="#/" /><span className="small">Setting up <b style={{ color: 'var(--ink)' }}>{p.name}</b></span></header>
      )}
      <main className="main narrow">
        {mobile ? null : <div className="col" style={{ gap: 6 }}>
          <h1 className="title">{editing ? 'Job preferences' : 'What kind of job are you looking for?'}</h1>
          <p className="sub">We use these to find and rank up to {p.limits.jobsPerDay} jobs for you every day. You can change them later in Settings.</p>
        </div>}
        {tried && errCount ? <Banner tone="err"><b>{errCount} {errCount === 1 ? 'thing' : 'things'} to fix</b> before we can find jobs.</Banner> : null}

        <section className="card" style={{ padding: mobile ? 18 : 28, gap: mobile ? 20 : 24 }}>
          <TagInput label="Job titles to search" value={f.titles} onChange={(v) => set('titles', v)} suggestions={TITLES[pid]} placeholder="Search or type a title" error={show('titles')} hint="Not in the list? Type it and press Enter to add it as a keyword." />
          <TagInput label="Titles to avoid (optional)" value={f.avoid} onChange={(v) => set('avoid', v)} suggestions={[]} placeholder="e.g. Graphic Designer" />
          <div className="grid2">
            <TagInput label="Locations" value={f.cities} onChange={(v) => set('cities', v)} suggestions={CITIES} placeholder="Add city" error={show('cities')} />
            <div className="field"><span>Work type</span>
              <div className="row"><Toggle on={W.office} onClick={() => set('work', { ...W, office: !W.office })}>Office</Toggle><Toggle on={W.hybrid} onClick={() => set('work', { ...W, hybrid: !W.hybrid })}>Hybrid</Toggle><Toggle on={W.remote} onClick={() => set('work', { ...W, remote: !W.remote })}>Remote</Toggle></div>
              {show('work') ? <span className="error"><Icon n="alert" s={16} />{errs.work}</span> : null}
            </div>
          </div>
          <div className="grid2">
            <div className="field"><span>Experience (years)</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                <label className="col small" style={{ gap: 4 }}>You have<input className="input" inputMode="decimal" value={f.expHave} onChange={(e) => set('expHave', e.target.value)} /></label>
                <label className="col small" style={{ gap: 4 }}>Show jobs from<input className={`input ${show('exp') ? 'bad' : ''}`} inputMode="decimal" value={f.expMin} onChange={(e) => set('expMin', e.target.value)} /></label>
                <label className="col small" style={{ gap: 4 }}>Up to<input className={`input ${show('exp') ? 'bad' : ''}`} inputMode="decimal" value={f.expMax} onChange={(e) => set('expMax', e.target.value)} /></label>
              </div>
              {show('exp') ? <span className="error"><Icon n="alert" s={16} />{errs.exp}</span> : null}
            </div>
            <div className="field"><span>Expected salary (₹ LPA)</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                <input aria-label="Minimum salary in lakhs" className={`input ${show('salary') ? 'bad' : ''}`} inputMode="decimal" placeholder="Min" value={f.salMin} onChange={(e) => set('salMin', e.target.value)} />
                <input aria-label="Maximum salary in lakhs" className={`input ${show('salary') ? 'bad' : ''}`} inputMode="decimal" placeholder="Max" value={f.salMax} onChange={(e) => set('salMax', e.target.value)} />
              </div>
              {show('salary') ? <span className="error"><Icon n="alert" s={16} />{errs.salary}</span> : <label className="check"><input type="checkbox" checked={f.includeNoSalary} onChange={(e) => set('includeNoSalary', e.target.checked)} />Also show jobs that don't mention salary</label>}
            </div>
          </div>
          <div className="field"><span>Notice period</span><div className="row">{NOTICE.map((n) => <Toggle key={n} on={f.notice === n} onClick={() => set('notice', f.notice === n ? '' : n)}>{n}</Toggle>)}</div></div>
          <TagInput label="Dream companies (optional, shown first)" value={f.companies} onChange={(v) => set('companies', v)} placeholder="Add a company" />
        </section>

        <section className="card" style={{ padding: mobile ? 18 : 28, gap: mobile ? 20 : 22 }}>
          <div className="field"><span>Master resume</span>
            {resume ? (
              <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', flexWrap: 'nowrap' }}>
                <div style={{ width: 34, height: 42, flex: 'none', borderRadius: 6, background: 'var(--tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#8F3412' }}>PDF</div>
                <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file || 'Resume'}</span><span className="small" style={{ fontWeight: 400 }}>{resume.name} · {resume.experience.length} roles</span></div>
                <button type="button" className="btn secondary sm" onClick={() => fileRef.current.click()} disabled={importing}>Replace</button>
              </div>
            ) : (
              <button type="button" className={`btn secondary full ${show('resume') ? 'bad' : ''}`} style={{ height: 56, borderStyle: 'dashed', borderColor: show('resume') ? 'var(--errb)' : undefined }} onClick={() => fileRef.current.click()} disabled={importing}>
                {importing ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />Reading your resume…</> : <><Icon n="upload" s={18} />Upload resume PDF</>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" onChange={onPdf} />
            <input ref={jsonRef} type="file" accept="application/json,.json" className="sr-only" onChange={onJson} />
            {show('resume') && !resume ? <span className="error"><Icon n="alert" s={16} />{errs.resume}</span> : <span className="hint">We read it into text so the AI can tailor it. Have a Shortlist resume file? <button type="button" className="btn ghost sm" style={{ height: 'auto', padding: 0 }} onClick={() => jsonRef.current.click()}>Load it instead</button></span>}
            {importMsg ? <Banner tone={importMsg.tone} icon={importMsg.tone === 'ok' ? 'check' : 'alert'}>{importMsg.text}</Banner> : null}
          </div>
        </section>

        {mobile ? null : (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {tried && errCount ? <span className="small">Fix the highlighted fields to continue</span> : null}
            <button className="btn lg" onClick={save} disabled={importing}>{editing ? 'Save preferences' : 'Save and find my jobs'}</button>
          </div>
        )}
      </main>
      {mobile ? (
        <div className="actionbar">
          {tried && errCount ? <span className="small" style={{ textAlign: 'center', color: 'var(--err)', fontWeight: 600 }}>Fix the highlighted fields to continue</span> : null}
          <button className="btn lg full" onClick={save} disabled={importing}>{editing ? 'Save preferences' : 'Save and find my jobs'}</button>
        </div>
      ) : null}
    </div>
  );
}
