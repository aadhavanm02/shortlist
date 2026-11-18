import { useState } from 'react';
import { useStore, updateProfile, resetProfile, usageOf, msUntilQuotaReset, formatDuration, exportProfile, setActive, getSaveError } from '../lib/store.js';
import { TopBar, Icon, Avatar, Modal, Field, Banner, useMobile } from '../components/ui.jsx';
import { downloadBlob } from '../lib/pdfDoc.jsx';
import { useAppVersion } from '../lib/native.js';

function Bar({ label, used, total, note, grey }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="col" style={{ padding: '16px 0', borderBottom: '1px solid var(--line)', gap: 8 }}>
      <div className="between"><b style={{ color: 'var(--ink)' }}>{label}</b><b style={{ color: 'var(--ink)', fontSize: 14 }}>{used} of {total} used</b></div>
      <div className="progress" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={total} style={{ height: 8 }}><div style={{ width: `${pct}%`, height: 8, background: grey ? '#8A8590' : undefined }} /></div>
      <span className="small">{note}</span>
    </div>
  );
}

export default function Settings({ pid, route }) {
  const p = useStore((s) => s.profiles[pid]);
  const [m, setM] = useState({ ...p.models });
  const [lim, setLim] = useState({ ...p.limits });
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const u = usageOf(p);
  const version = useAppVersion();
  const mobile = useMobile();

  const save = () => {
    updateProfile(pid, (pp) => {
      pp.models = m;
      pp.limits = { jobsPerDay: clampN(lim.jobsPerDay, 5, 50), tailorPerDay: clampN(lim.tailorPerDay, 1, 100), refinePerDay: clampN(lim.refinePerDay, 10, 1000), refinePerJob: clampN(lim.refinePerJob, 1, 50) };
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const row = (title, sub, right) => (
    <div className="between" style={{ padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
      <div className="col" style={{ gap: 3, minWidth: 0 }}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</span><span className="small">{sub}</span></div>{right}
    </div>
  );
  const num = (key, label, hint) => <Field label={label} hint={hint}><input className="input" inputMode="numeric" value={lim[key]} onChange={(e) => setLim({ ...lim, [key]: e.target.value.replace(/\D/g, '') })} /></Field>;
  const err = getSaveError();

  return (
    <div className="app">
      <TopBar pid={pid} route={route} title="Settings" />
      <main className="main narrow">
        {mobile ? null : <h1 className="title">Settings</h1>}
        {err ? <Banner tone="err">{err}</Banner> : null}
        <section className="card" style={{ padding: '8px 28px 20px', gap: 0 }}>
          <div className="row" style={{ padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap', gap: 14 }}>
            <Avatar id={pid} s={46} />
            <div className="col" style={{ flex: 1, gap: 2 }}><b style={{ color: 'var(--ink)', fontSize: 16 }}>{p.name}</b><span className="small">{p.role} · {p.prefs.cities.join(', ') || 'Remote'}</span></div>
            <button className="btn ghost sm" onClick={() => { setActive(null); location.hash = '#/'; }}>Switch profile</button>
          </div>
          {row('Job preferences', `${p.prefs.titles.length} titles · ${p.prefs.cities.join(', ') || 'Remote'}${p.prefs.expMin || p.prefs.expMax ? ` · ${p.prefs.expMin || 0}–${p.prefs.expMax || '?'} yrs` : ''}`, <a className="btn secondary sm" href="#/setup">Edit</a>)}
          {row('Master resume', p.resumeFile || p.resume?.name || 'Not added', <a className="btn secondary sm" href="#/resumes/master">Edit</a>)}
        </section>

        <section className="card" id="usage" style={{ padding: '20px 28px', gap: 0 }}>
          <h2 style={{ fontSize: 20 }}>AI usage today</h2>
          <span className="small" style={{ marginTop: 4 }}>You both share the app's free keys, so these limits are split between you. Resets in {formatDuration(msUntilQuotaReset())}.</span>
          <Bar label="Tailorings" used={u.tailor} total={p.limits.tailorPerDay} note="The first AI pass for a job. Uses Gemini Flash, the best free model." />
          <Bar label="Refinements" used={u.refine} total={p.limits.refinePerDay} note={`Chat changes, trims and resume import. Up to ${p.limits.refinePerJob} per job. Uses Gemini Flash-Lite.`} />
          <Bar label="Backup (Groq)" used={u.groq} total={40} grey note="Only used if you choose it when Gemini is busy or out. About 40 resume-sized requests a day." />
          <span className="small" style={{ paddingTop: 14 }}>Limits come from the free AI providers and can change. Manual edits never count.</span>
        </section>


        <section className="card" style={{ padding: 28, gap: 18 }}>
          <h2 style={{ fontSize: 20 }}>Limits and models</h2>
          <div className="grid2" style={{ gap: 14 }}>
            {num('jobsPerDay', 'Jobs per day', 'Top matches shown each day.')}
            {num('refinePerJob', 'Refinements per job', 'Chat messages for one job.')}
            {num('tailorPerDay', 'Tailorings per day', 'Shared Gemini Flash free limit is about 20 a day.')}
            {num('refinePerDay', 'Refinements per day', 'Shared Flash-Lite free limit is about 500 a day.')}
          </div>
          <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Model names (change only if a model stops working)</summary>
            <div className="grid2" style={{ gap: 12, marginTop: 12 }}>
              <Field label="Tailoring model"><input className="input" value={m.tailor} onChange={(e) => setM({ ...m, tailor: e.target.value })} /></Field>
              <Field label="Refinement model"><input className="input" value={m.refine} onChange={(e) => setM({ ...m, refine: e.target.value })} /></Field>
              <Field label="Groq model"><input className="input" value={m.groq} onChange={(e) => setM({ ...m, groq: e.target.value })} /></Field>
            </div>
          </details>
        </section>

        <div className="between">
          <div className="row">
            <button className="btn secondary sm" onClick={() => downloadBlob(new Blob([exportProfile(pid)], { type: 'application/json' }), `shortlist-${p.name.toLowerCase()}.json`)}><Icon n="download" s={16} />Export profile</button>
            <button className="btn danger sm" onClick={() => setConfirm(true)}>Reset this profile</button>
          </div>
          <button className="btn" onClick={save}>{saved ? '✓ Saved' : 'Save settings'}</button>
        </div>
        <span className="small">Export keeps your preferences and master resume in a file you can load on another device.</span>
        <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><span className="small">{version}</span><a href="../changelog.html" target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600 }}>What's new</a></div>
      </main>
      {confirm ? (
        <Modal onClose={() => setConfirm(false)} labelledBy="rst">
          <h2 id="rst">Reset {p.name}'s profile?</h2>
          <p className="sub" style={{ lineHeight: 1.5 }}>This removes preferences, master resume, saved versions and job history from this browser. Downloaded PDFs stay on your device. This can't be undone.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn dangerfill" onClick={() => { resetProfile(pid); location.hash = '#/'; }}>Reset profile</button></div>
        </Modal>
      ) : null}
    </div>
  );
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, parseInt(v, 10) || a));
