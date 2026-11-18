import { useState } from 'react';
import { useStore, updateProfile, resetProfile, usageOf, msUntilQuotaReset, formatDuration, exportProfile, getSaveError } from '../lib/store.js';
import { TopBar, Icon, Avatar, Modal, Field, Banner, useMobile } from '../components/ui.jsx';
import { downloadBlob } from '../lib/pdfDoc.jsx';
import { useAppVersion, useInstall } from '../lib/pwa.js';
import { signOut, useAuth } from '../lib/sync.js';

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
  const inst = useInstall();
  const auth = useAuth();
  const doSignOut = async () => { await signOut(); location.hash = '#/'; };
  const roleLine = p.role || p.prefs.titles[0] || '';
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

  const resetModal = confirm ? (
    <Modal onClose={() => setConfirm(false)} labelledBy="rst">
      <h2 id="rst">Reset {p.name}'s profile?</h2>
      <p className="sub" style={{ lineHeight: 1.5 }}>This removes your preferences, master resume, saved versions and job history from your account on every device. Downloaded PDFs stay where you saved them. This can't be undone.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn dangerfill" onClick={() => { resetProfile(pid); setConfirm(false); location.hash = '#/setup'; }}>Reset profile</button></div>
    </Modal>
  ) : null;
  const chev = <span className="chev"><Icon n="chev" s={18} /></span>;
  const meterRow = (label, used, total) => (
    <div className="mrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '14px 16px' }}>
      <div className="between" style={{ flexWrap: 'nowrap' }}><span className="mrow-t">{label}</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{used} of {total}</span></div>
      <div className="progress"><div style={{ width: `${total ? Math.min(100, Math.round((used / total) * 100)) : 0}%` }} /></div>
    </div>
  );

  if (mobile) return (
    <div className="app">
      <TopBar pid={pid} route={route} title="Settings" />
      <main className="main" style={{ padding: '14px 16px 24px', gap: 10 }}>
        {err ? <Banner tone="err">{err}</Banner> : null}
        {auth.error ? <Banner tone="warn">{auth.error}</Banner> : null}
        <div className="mlist">
          <div className="mrow" style={{ gap: 12, padding: '12px 16px' }}>
            <Avatar id={pid} s={48} />
            <span className="mrow-main"><span className="mrow-t" style={{ fontSize: 17 }}>{p.name}</span><span className="mrow-s">{p.email || roleLine}</span></span>
          </div>
          <button className="mrow" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer' }} onClick={doSignOut}><span className="mrow-main"><span className="mrow-t" style={{ color: 'var(--err)' }}>Sign out</span><span className="mrow-s">Your data stays saved in your account</span></span></button>
        </div>

        <span className="label" style={{ margin: '10px 4px 0' }}>Job search</span>
        <div className="mlist">
          <a className="mrow" href="#/setup" style={{ textDecoration: 'none' }}><span className="mrow-main"><span className="mrow-t">Job preferences</span><span className="mrow-s">{p.prefs.titles.length} titles · {p.prefs.cities.join(', ') || 'Remote'}{p.prefs.expMin || p.prefs.expMax ? ` · ${p.prefs.expMin || 0}–${p.prefs.expMax || '?'} yrs` : ''}</span></span>{chev}</a>
          <a className="mrow" href="#/resumes/master" style={{ textDecoration: 'none' }}><span className="mrow-main"><span className="mrow-t">Master resume</span><span className="mrow-s">{p.resumeFile || p.resume?.name || 'Not added'} · edit or replace</span></span>{chev}</a>
        </div>

        <span className="label" style={{ margin: '10px 4px 0' }}>AI usage today · resets in {formatDuration(msUntilQuotaReset())}</span>
        <div className="mlist">
          {meterRow('Tailorings', u.tailor, p.limits.tailorPerDay)}
          {meterRow('Refinements', u.refine, p.limits.refinePerDay)}
        </div>

        <span className="label" style={{ margin: '10px 4px 0' }}>App</span>
        <div className="mlist">
          {!inst.installed ? (inst.canPrompt
            ? <button className="mrow" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={inst.install}><span className="mrow-main"><span className="mrow-t">Install Shortlist</span><span className="mrow-s">Open it from your home screen</span></span><span className="chev"><Icon n="download" s={18} /></span></button>
            : <a className="mrow" href="../install.html" style={{ textDecoration: 'none' }}><span className="mrow-main"><span className="mrow-t">Install Shortlist</span><span className="mrow-s">Open it from your home screen</span></span>{chev}</a>) : null}
          <a className="mrow" href="../changelog.html" style={{ textDecoration: 'none' }}><span className="mrow-main"><span className="mrow-t">What's new</span><span className="mrow-s">{version}</span></span>{chev}</a>
          <button className="mrow" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer' }} onClick={() => downloadBlob(new Blob([exportProfile(pid)], { type: 'application/json' }), `shortlist-${p.name.toLowerCase()}.json`)}><span className="mrow-main"><span className="mrow-t">Export profile</span><span className="mrow-s">Preferences and master resume as a file</span></span><span className="chev"><Icon n="download" s={18} /></span></button>
        </div>

        <details className="mlist" style={{ padding: '0 16px' }}>
          <summary style={{ minHeight: 56, display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>Limits and models</summary>
          <div className="col" style={{ gap: 14, paddingBottom: 16 }}>
            {num('jobsPerDay', 'Jobs per day', 'Top matches shown each day.')}
            {num('refinePerJob', 'Refinements per job', 'Chat messages for one job.')}
            {num('tailorPerDay', 'Tailorings per day', 'Shared Gemini Flash limit is about 20 a day.')}
            {num('refinePerDay', 'Refinements per day', 'Shared Flash-Lite limit is about 500 a day.')}
            <Field label="Tailoring model"><input className="input" value={m.tailor} onChange={(e) => setM({ ...m, tailor: e.target.value })} /></Field>
            <Field label="Refinement model"><input className="input" value={m.refine} onChange={(e) => setM({ ...m, refine: e.target.value })} /></Field>
            <button className="btn full" onClick={save}>{saved ? '✓ Saved' : 'Save'}</button>
          </div>
        </details>

        <button className="btn danger full" style={{ marginTop: 6 }} onClick={() => setConfirm(true)}>Reset this profile</button>
      </main>
      {resetModal}
    </div>
  );

  return (
    <div className="app">
      <TopBar pid={pid} route={route} title="Settings" />
      <main className="main narrow">
        {mobile ? null : <h1 className="title">Settings</h1>}
        {err ? <Banner tone="err">{err}</Banner> : null}
        {auth.error ? <Banner tone="warn">{auth.error}</Banner> : null}
        <section className="card" style={{ padding: '8px 28px 20px', gap: 0 }}>
          <div className="row" style={{ padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap', gap: 14 }}>
            <Avatar id={pid} s={46} />
            <div className="col" style={{ flex: 1, gap: 2 }}><b style={{ color: 'var(--ink)', fontSize: 16 }}>{p.name}</b><span className="small">{p.email || roleLine}</span></div>
            <button className="btn ghost sm" onClick={doSignOut}>Sign out</button>
          </div>
          {row('Job preferences', `${p.prefs.titles.length} titles · ${p.prefs.cities.join(', ') || 'Remote'}${p.prefs.expMin || p.prefs.expMax ? ` · ${p.prefs.expMin || 0}–${p.prefs.expMax || '?'} yrs` : ''}`, <a className="btn secondary sm" href="#/setup">Edit</a>)}
          {row('Master resume', `${p.resumeFile || p.resume?.name || 'Not added'} · edit or replace with a new PDF`, <a className="btn secondary sm" href="#/resumes/master">Edit</a>)}
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
        {!inst.installed ? (
          <section className="card" style={{ gap: 10 }}>
            <div className="between" style={{ flexWrap: 'nowrap' }}><div className="col" style={{ gap: 2 }}><b style={{ color: 'var(--ink)' }}>Install Shortlist</b><span className="small">Open it full screen from your home screen, like an app.</span></div>
              {inst.canPrompt ? <button className="btn sm" onClick={inst.install}>Install</button> : <a className="btn secondary sm" href="../install.html">How to</a>}</div>
          </section>
        ) : null}
        <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><span className="small">{version}</span><a href="../changelog.html" style={{ fontSize: 14, fontWeight: 600 }}>What's new</a></div>
      </main>
      {confirm ? (
        <Modal onClose={() => setConfirm(false)} labelledBy="rst">
          <h2 id="rst">Reset {p.name}'s profile?</h2>
          <p className="sub" style={{ lineHeight: 1.5 }}>This removes your preferences, master resume, saved versions and job history from your account on every device. Downloaded PDFs stay where you saved them. This can't be undone.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button><button className="btn dangerfill" onClick={() => { resetProfile(pid); setConfirm(false); location.hash = '#/setup'; }}>Reset profile</button></div>
        </Modal>
      ) : null}
    </div>
  );
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, parseInt(v, 10) || a));
