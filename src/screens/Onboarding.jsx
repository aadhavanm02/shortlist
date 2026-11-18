import { useEffect, useRef, useState } from 'react';
import { useStore, updateProfile } from '../lib/store.js';
import { Logo, Banner, Field, TagInput, Toggle, Icon, TopBar, useMobile, AppBar } from '../components/ui.jsx';
import { importResumePdf } from '../lib/importResume.js';
import { fetchMaster } from '../lib/sync.js';
import { normalizeResume } from '../lib/resume.js';

const TITLES = {
  A: ['Product Designer', 'Senior Product Designer', 'UX Designer', 'Senior UX Designer', 'UI/UX Designer', 'UX/UI Designer', 'Interaction Designer', 'Product Design Lead', 'Visual Designer', 'UX Researcher', 'Design Systems Designer', 'Staff Product Designer'],
  G: ['Business Analyst', 'Senior Business Analyst', 'Business Systems Analyst', 'Product Analyst', 'Data Analyst', 'Quality Analyst', 'Content Quality Analyst', 'Metadata Analyst', 'Functional Analyst', 'Functional Consultant', 'IT Business Analyst', 'Associate Product Owner', 'Process Analyst', 'Requirements Analyst'],
};
const CITIES = ['Chennai', 'Bangalore', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Gurgaon', 'Noida', 'Coimbatore', 'Kochi', 'Pondicherry', 'Ahmedabad', 'Kolkata'];

export default function Onboarding({ pid, editing }) {
  const mobile = useMobile();
  const p = useStore((s) => s.profiles[pid]);
  const [f, setF] = useState(() => structuredClone(p.prefs));
  const [resume, setResume] = useState(p.resume);
  const [file, setFile] = useState(p.resumeFile);
  const [tried, setTried] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null);
  // New accounts: load the master resume stored for this Google account, so there's nothing to upload
  const [masterState, setMasterState] = useState(p.resume || editing ? 'done' : 'loading');
  useEffect(() => {
    if (masterState !== 'loading') return;
    fetchMaster().then((m) => {
      if (m?.resume) {
        setResume(normalizeResume(m.resume)); setFile(m.fileName || 'Master resume');
        if (m.prefs) setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(m.prefs).filter(([k]) => !(Array.isArray(x[k]) ? x[k].length : x[k] && k !== 'work'))) }));
        setMasterState('found');
      } else setMasterState('none');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const smin = parseFloat(f.salMin), smax = parseFloat(f.salMax);
  const errs = {
    titles: f.titles.length ? null : 'Add at least one job title',
    cities: f.cities.length || f.work.remote ? null : 'Add at least one city, or choose Remote',
    work: f.work.office || f.work.hybrid || f.work.remote ? null : 'Pick at least one work type',
    salary: smin && smax && smin > smax ? "Minimum can't be more than maximum" : null,
    exp: f.expMin && f.expMax && +f.expMin > +f.expMax ? "'From' can't be more than 'Up to'" : null,
    resume: resume || masterState === 'loading' ? null : 'Upload your resume PDF',
  };
  const errCount = Object.values(errs).filter(Boolean).length;
  const show = (k) => (tried ? errs[k] : null);

  async function onPdf(e) {
    const fl = e.target.files?.[0]; e.target.value = '';
    if (!fl) return;
    setImporting(true); setImportMsg(null);
    const { resume: r, msg } = await importResumePdf(pid, fl, p.name);
    if (r) { setResume(r); setFile(fl.name); }
    setImportMsg(msg); setImporting(false);
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
          <TagInput label="Job titles to search" value={f.titles} onChange={(v) => set('titles', v)} suggestions={[...TITLES.A, ...TITLES.G]} placeholder="Search or type a title" error={show('titles')} hint="Not in the list? Type it and press Enter to add it as a keyword." />
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
        </section>

        {masterState === 'loading' ? <div className="row small" style={{ gap: 10 }}><span className="spinner" style={{ width: 18, height: 18, borderWidth: 3 }} />Loading your resume…</div> : null}
        {masterState === 'found' ? <div className="row small" style={{ gap: 8, flexWrap: 'nowrap' }}><Icon n="check" s={16} c="var(--ok)" />Using your master resume ({file}). You can replace it in Settings.</div> : null}
        {masterState === 'none' && !editing ? (
          <section className="card" style={{ padding: mobile ? 18 : 28, gap: 14 }}>
            <div className="field"><span>Your resume</span>
              {resume ? (
                <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', flexWrap: 'nowrap' }}>
                  <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file || 'Resume'}</span><span className="small" style={{ fontWeight: 400 }}>{resume.name} · {resume.experience.length} roles</span></div>
                  <button type="button" className="btn secondary sm" onClick={() => fileRef.current.click()} disabled={importing}>Replace</button>
                </div>
              ) : (
                <button type="button" className="btn secondary full" style={{ height: 56, borderStyle: 'dashed', borderColor: show('resume') ? 'var(--errb)' : undefined }} onClick={() => fileRef.current.click()} disabled={importing}>
                  {importing ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 3 }} />Reading your resume…</> : <><Icon n="upload" s={18} />Upload resume PDF</>}
                </button>
              )}
              {show('resume') && !resume ? <span className="error"><Icon n="alert" s={16} />{errs.resume}</span> : null}
              {importMsg ? <Banner tone={importMsg.tone} icon={importMsg.tone === 'ok' ? 'check' : 'alert'}>{importMsg.text}</Banner> : null}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" onChange={onPdf} />
          </section>
        ) : null}

        {mobile ? null : (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {tried && errCount ? <span className="small">Fix the highlighted fields to continue</span> : null}
            <button className="btn lg" onClick={save} disabled={importing || masterState === 'loading'}>{editing ? 'Save preferences' : 'Save and find my jobs'}</button>
          </div>
        )}
      </main>
      {mobile ? (
        <div className="actionbar">
          {tried && errCount ? <span className="small" style={{ textAlign: 'center', color: 'var(--err)', fontWeight: 600 }}>Fix the highlighted fields to continue</span> : null}
          <button className="btn lg full" onClick={save} disabled={importing || masterState === 'loading'}>{editing ? 'Save preferences' : 'Save and find my jobs'}</button>
        </div>
      ) : null}
    </div>
  );
}
