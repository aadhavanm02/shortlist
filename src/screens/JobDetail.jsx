import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, updateProfile, usageOf, msUntilQuotaReset, formatDuration } from '../lib/store.js';
import { findJob, setJobStatus } from '../lib/jobs.js';
import { useStatus } from '../lib/api.js';
import { callAI, tailorPrompt, cleanTailor, refinePrompt, trimPrompt, AIError, dropLabel } from '../lib/ai.js';
import { setPath, getPath, validPath, pathLabel, normalizeResume, stripDashes, segments } from '../lib/resume.js';
import { buildPdf, downloadBlob } from '../lib/pdfDoc.jsx';
import { TopBar, Icon, Banner, Empty, Score, Modal, useMobile, AppBar } from '../components/ui.jsx';
import ResumeView from '../components/ResumeView.jsx';

const H = { fontFamily: 'var(--h)', fontWeight: 800, color: 'var(--ink)' };
const Rich = ({ t }) => segments(t).map((s, i) => (s.b ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>));

function saveVersion(pid, id, fn) { updateProfile(pid, (p) => { fn(p.versions[id], p); }); }

export default function JobDetail({ pid, id, route }) {
  const p = useStore((s) => s.profiles[pid]);
  const groqOn = !!useStatus()?.groq;
  const mobile = useMobile();
  const [mtab, setMtab] = useState(p.versions[id] ? 'resume' : 'job');
  const job = findJob(p, id);
  const v = p.versions[id];
  const [phase, setPhase] = useState(null);   // null | 'working' | {error}
  const [tab, setTab] = useState(v ? 'sugg' : 'job');
  const [chat, setChat] = useState(false);
  const [edit, setEdit] = useState(null);     // path being edited
  const [limit, setLimit] = useState(false);
  const [applyQ, setApplyQ] = useState(null);
  const [fit, setFit] = useState({ overLines: 0 });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [trims, setTrims] = useState(null);
  const [pasteJD, setPasteJD] = useState('');
  const step = useRef(0); const [, force] = useState(0);
  const master = useMemo(() => (p.resume ? normalizeResume(p.resume) : null), [p.resume]);
  const onFit = (f) => setFit((o) => (o.overLines === f.overLines && o.size === f.size ? o : f));

  useEffect(() => { if (v && tab === 'job' && !phase) setTab('sugg'); if (v) setMtab('resume'); }, [!!v]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return (<div className="app"><TopBar pid={pid} route={route} back={{ href: '#/jobs', label: 'Back to jobs' }} /><main className="main"><Empty title="This job isn't in your list any more">It may be from an older day's list. Go back to today's jobs.</Empty></main></div>);
  if (!p.resume) return (<div className="app"><TopBar pid={pid} route={route} back={{ href: '#/jobs', label: 'Back to jobs' }} /><main className="main"><Empty title="Add your resume first" actions={<a className="btn" href="#/setup">Upload resume</a>}>Tailoring starts from your master resume.</Empty></main></div>);

  const u = usageOf(p);
  const tailorLeft = Math.max(0, p.limits.tailorPerDay - u.tailor);
  const refineLeft = v ? Math.max(0, Math.min(p.limits.refinePerJob - (v.refineUsed || 0), p.limits.refinePerDay - u.refine)) : 0;
  const resume = v ? v.resume : master;
  const highlight = v ? [...new Set([...(v.suggestions || []).filter((s) => s.state === 'done').map((s) => s.path), ...(v.changed || [])])] : [];

  // ---------- tailoring ----------
  async function tailor(engine = 'tailor') {
    setLimit(false); setPhase('working'); step.current = 0;
    const tick = setInterval(() => { step.current = Math.min(2, step.current + 1); force((x) => x + 1); }, 2500);
    try {
      const base = normalizeResume(p.resume);
      const { system, user } = tailorPrompt(base, job);
      const out = await callAI(pid, engine, system, user);
      const t = cleanTailor(base, out);
      updateProfile(pid, (pp) => { pp.versions[id] = { resume: base, ...t, chat: [], refineUsed: 0, changed: [], undo: [], createdAt: Date.now(), engine }; pp.jobCache[id] = job; });
      setPhase(null); setTab('sugg');
    } catch (e) {
      if (e instanceof AIError && e.kind === 'quota' && engine === 'tailor') { setPhase(null); setLimit(true); }
      else setPhase({ error: e.message || 'Something went wrong.', kind: e.kind });
    } finally { clearInterval(tick); }
  }
  function startTailor() { if (tailorLeft === 0) setLimit(true); else tailor('tailor'); }

  // ---------- suggestions ----------
  const accept = (s) => saveVersion(pid, id, (vv) => {
    if (!validPath(vv.resume, s.path)) return;
    vv.undo = [...(vv.undo || []), vv.resume].slice(-10);
    vv.resume = setPath(vv.resume, s.path, s.after);
    vv.suggestions = vv.suggestions.map((x) => (x.id === s.id ? { ...x, state: 'done' } : x));
  });
  const reject = (s) => saveVersion(pid, id, (vv) => { vv.suggestions = vv.suggestions.map((x) => (x.id === s.id ? { ...x, state: 'rej' } : x)); });
  const acceptAll = () => saveVersion(pid, id, (vv) => {
    vv.undo = [...(vv.undo || []), vv.resume].slice(-10);
    vv.suggestions.forEach((s) => { if (s.state === 'open' && validPath(vv.resume, s.path)) vv.resume = setPath(vv.resume, s.path, s.after); });
    vv.suggestions = vv.suggestions.map((x) => (x.state === 'open' ? { ...x, state: 'done' } : x));
  });
  const answer = (q, yes) => saveVersion(pid, id, (vv) => {
    if (yes && q.addTo && validPath(vv.resume, q.addTo)) {
      const cur = getPath(vv.resume, q.addTo).replace(/\.\s*$/, '');
      vv.undo = [...(vv.undo || []), vv.resume].slice(-10);
      vv.resume = setPath(vv.resume, q.addTo, `${cur}, ${q.skill}.`);
      vv.changed = [...new Set([...(vv.changed || []), q.addTo])];
    }
    vv.questions = vv.questions.map((x) => (x.id === q.id ? { ...x, state: yes ? 'yes' : 'no' } : x));
  });

  // ---------- manual edit (no AI) ----------
  function saveEdit(path, text) {
    updateProfile(pid, (pp) => {
      if (!pp.versions[id]) pp.versions[id] = { resume: normalizeResume(pp.resume), suggestions: [], questions: [], chat: [], refineUsed: 0, changed: [], undo: [], createdAt: Date.now(), engine: 'manual' };
      const vv = pp.versions[id];
      vv.undo = [...(vv.undo || []), vv.resume].slice(-10);
      vv.resume = setPath(vv.resume, path, text);
      vv.changed = [...new Set([...(vv.changed || []), path])];
      pp.jobCache[id] = job;
    });
    setEdit(null);
  }
  const undo = () => saveVersion(pid, id, (vv) => { const prev = (vv.undo || []).pop(); if (prev) vv.resume = prev; });

  // ---------- trims when over one page ----------
  async function askTrims() {
    setTrims('loading');
    try {
      const { system, user } = trimPrompt(v.resume, fit.overLines);
      const out = await callAI(pid, 'refine', system, user);
      saveVersion(pid, id, (vv) => { vv.refineUsed = (vv.refineUsed || 0) + 1; });
      setTrims((out.trims || []).map((t) => ({ ...t, changes: (t.changes || []).filter((c) => validPath(v.resume, c.path)) })).filter((t) => t.changes.length));
    } catch (e) { setTrims({ error: e.message }); }
  }
  const applyTrim = (t) => saveVersion(pid, id, (vv) => {
    vv.undo = [...(vv.undo || []), vv.resume].slice(-10);
    t.changes.forEach((c) => { vv.resume = setPath(vv.resume, c.path, stripDashes(dropLabel(vv.resume, c.path, c.after))); vv.changed = [...new Set([...(vv.changed || []), c.path])]; });
  });

  // ---------- PDF ----------
  async function download() {
    setPdfBusy(true);
    try {
      const { blob, pages } = await buildPdf(resume);
      if (pages > 1) { setFit({ overLines: Math.max(fit.overLines, 1) }); return; }
      const name = `Resume - ${resume.name} - ${job.company}.pdf`;
      downloadBlob(blob, name);
      updateProfile(pid, (pp) => { if (!pp.versions[id]) pp.versions[id] = { resume, suggestions: [], questions: [], chat: [], refineUsed: 0, changed: [], undo: [], createdAt: Date.now(), engine: 'none' }; pp.versions[id].downloadedAt = Date.now(); pp.jobCache[id] = job; });
      if (p.status[id]?.s !== 'applied') setApplyQ(name);
    } finally { setPdfBusy(false); }
  }

  const back = { href: '#/jobs', label: 'Back to jobs' };
  const over = fit.overLines > 0;
  const resumePanel = (
    <>
      <div className="between">
        <div className="col" style={{ gap: 2 }}><span style={{ ...H, fontSize: 17 }}>{v ? `Tailored for ${job.company}` : 'Your resume'}</span><span className="small">{v ? 'Changes are highlighted. Click any line to edit it yourself.' : 'Master version. Click a line to edit it for this job only.'}</span></div>
        <div className="row">{v?.undo?.length ? <button className="btn secondary sm" onClick={undo}><Icon n="undo" s={16} />Undo</button> : null}<button className="btn sm" onClick={download} disabled={pdfBusy || over}><Icon n="download" s={16} />{pdfBusy ? 'Making PDF…' : 'Download PDF'}</button></div>
      </div>
      {over ? <Banner action={v && refineLeft ? <button className="btn secondary sm" onClick={askTrims} disabled={trims === 'loading'}>{trims === 'loading' ? 'Thinking…' : 'Suggest trims'}</button> : null}><b>This version runs onto a second page</b> by about {fit.overLines} lines. Download unlocks once it fits. Edit a line yourself{v && refineLeft ? ', or let the AI suggest trims (uses 1 refinement)' : ''}.</Banner> : null}
      {Array.isArray(trims) && over ? trims.map((t, i) => <div key={i} className="sugg"><b style={{ color: 'var(--ink)', fontSize: 14 }}>{t.title}</b><span className="small">{t.detail}</span><div><button className="btn sm" onClick={() => { applyTrim(t); setTrims(null); }}>Apply trim</button></div></div>) : null}
      {trims?.error ? <Banner tone="err">{trims.error}</Banner> : null}
      <ResumeView r={resume} highlight={highlight} onEdit={(path) => setEdit(path)} onFit={onFit} dim={phase === 'working'} />
    </>
  );

  // ---------- left: job description ----------
  const jdPanel = (
    <div className="card" style={{ padding: 28, gap: 18 }}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 16 }}>
        <div className="logo-sq" style={{ width: 56, height: 56, flex: 'none', borderRadius: 12, background: '#F3F1EF', display: 'flex', alignItems: 'center', justifyContent: 'center', ...H, fontSize: 22, color: 'var(--txt)' }}>{(job.company || '?')[0]}</div>
        <div className="col" style={{ flex: 1, gap: 6 }}>
          <h1 style={{ fontSize: 24 }}>{job.title}</h1>
          <span>{job.company} · {job.location} · {job.mode}</span>
          <div className="row" style={{ gap: 6 }}><span className="chip ink">{job.salary}</span>{job.expText ? <span className="chip">{job.expText}</span> : null}{job.ago ? <span className="chip">Posted {job.ago}</span> : null}<span className="chip">via {job.source}{job.alsoOn?.length ? ` · also on ${job.alsoOn.slice(0, 2).join(', ')}` : ''}</span></div>
        </div>
        <Score n={v?.atsAfter && v.suggestions.every((s) => s.state !== 'open') ? v.atsAfter : job.score} big />
      </div>
      <div className="row">
        {job.url ? <a className="btn secondary sm" href={job.url} target="_blank" rel="noreferrer"><Icon n="ext" s={16} />Open original posting</a> : null}
        {p.status[id]?.s === 'applied' ? <span className="chip ok">Applied</span> : <button className="btn secondary sm" onClick={() => { setJobStatus(pid, job, 'applied'); location.hash = '#/jobs?tab=applied'; }}>Mark as applied</button>}
        {!p.status[id] ? <button className="btn secondary sm" onClick={() => { setJobStatus(pid, job, 'skipped'); location.hash = '#/jobs'; }}>Skip</button> : null}
      </div>
      {job.emails?.length ? (
        <div className="row" style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', flexWrap: 'nowrap' }}>
          <Icon n="mail" />
          <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}><span style={{ fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.emails[0]}</span><span className="small">Found in the job post</span></div>
          <button className="btn secondary sm" onClick={() => navigator.clipboard?.writeText(job.emails[0])}>Copy</button>
        </div>
      ) : null}
      {v?.have?.length || v?.missing?.length || job.matched?.length ? (
        <div className="grid2" style={{ gap: 16 }}>
          <div className="col"><span className="label" style={{ color: 'var(--ok)' }}>Already in your resume</span><div className="row" style={{ gap: 6 }}>{(v?.have?.length ? v.have : job.matched).map((k) => <span key={k} className="chip ok">{k}</span>)}</div></div>
          {v?.missing?.length ? <div className="col"><span className="label" style={{ color: '#8F3412' }}>Asked for, not in your resume</span><div className="row" style={{ gap: 6 }}>{v.missing.map((k) => <span key={k} className="chip acc">{k}</span>)}</div></div> : null}
        </div>
      ) : null}
      {job.short ? (
        <div className="col" style={{ gap: 10 }}>
          <Banner tone="info" icon="info">This source only shows part of the description. For better tailoring, open the posting and paste the full description here.</Banner>
          <textarea className="textarea" rows={4} placeholder="Paste the full job description" value={pasteJD} onChange={(e) => setPasteJD(e.target.value)} aria-label="Full job description" />
          <div><button className="btn secondary sm" disabled={pasteJD.trim().length < 200} onClick={() => { updateProfile(pid, (pp) => { const upd = (j) => { if (j && j.id === id) { j.description = pasteJD.trim(); j.short = false; } }; pp.feed?.list.forEach(upd); pp.feed?.close.forEach(upd); upd(pp.jobCache[id]); }); setPasteJD(''); }}>Use this description</button></div>
        </div>
      ) : null}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{job.description || 'No description was provided. Open the original posting to read it.'}</div>
    </div>
  );

  const open = v ? v.suggestions.filter((s) => s.state === 'open') : [];
  const suggPanel = v ? (
    <>
      <div className="between"><span>ATS match <b style={{ color: 'var(--mut)' }}>{v.atsBefore || job.score}%</b> → <b style={{ color: 'var(--ok)' }}>{v.atsAfter || '—'}%</b> {open.length ? 'if you accept all' : ''}</span>{open.length ? <button className="btn secondary sm" onClick={acceptAll}>Accept all</button> : null}</div>
      {v.engine && v.engine !== 'tailor' && v.engine !== 'manual' && v.engine !== 'none' ? <Banner tone="info" icon="info">Made with the backup model ({v.engine === 'groq' ? 'Groq' : 'Gemini Flash-Lite'}). Review the wording closely.</Banner> : null}
      {v.suggestions.map((s) => (
        <article key={s.id} className="sugg">
          <div className="between"><b style={{ fontSize: 13, color: 'var(--ink)' }}>{pathLabel(v.resume, s.path)}</b>{s.state === 'done' ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>✓ Accepted</span> : s.state === 'rej' ? <span className="small" style={{ fontWeight: 700 }}>Rejected</span> : null}</div>
          <span className="before"><Rich t={s.before} /></span><span className="after"><Rich t={s.after} /></span>
          {s.why ? <span className="small">{s.why}</span> : null}
          {s.state === 'open' ? <div className="row"><button className="btn sm" onClick={() => accept(s)}>Accept</button><button className="btn secondary sm" onClick={() => reject(s)}>Reject</button></div> : null}
        </article>
      ))}
      {v.questions.filter((q) => q.state === 'open').map((q) => (
        <article key={q.id} className="ask"><b style={{ fontSize: 13, color: '#8F3412' }}>Needs your answer</b><span style={{ fontSize: 14, color: 'var(--ink)' }}>{q.question} It isn't in your resume, so it wasn't added.</span>
          <div className="row"><button className="btn secondary sm" onClick={() => answer(q, true)}>Yes, add it</button><button className="btn secondary sm" onClick={() => answer(q, false)}>No, leave it out</button></div></article>
      ))}
      {!v.suggestions.length && !v.questions.length ? <Banner tone="ok" icon="check">No AI suggestions here. Edit lines yourself or refine with chat.</Banner> : null}
    </>
  ) : null;

  const working = (
    <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 36, gap: 18 }}>
      <div className="spinner" role="img" aria-label="Working" />
      <h2 style={{ fontSize: 22 }}>Tailoring your resume</h2><span className="small">Usually takes about 10 seconds</span>
      <div className="col" style={{ alignSelf: 'stretch', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 14, padding: 16, gap: 12 }}>
        {['Reading the job description', 'Matching keywords to your resume', 'Writing suggestions'].map((t, i) => (
          <div key={t} className="row" style={{ color: i <= step.current ? 'var(--ink)' : 'var(--mut)', flexWrap: 'nowrap' }}>
            {i < step.current ? <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--okbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="check" s={14} w={3} c="var(--ok)" /></span> : i === step.current ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)' }} />}{t}
          </div>
        ))}
      </div>
    </div>
  );
  const errorCard = phase?.error ? (
    <Empty icon="alert" tone="err" title="Couldn't tailor right now" actions={<><button className="btn" onClick={() => tailor('tailor')}>Try again</button><button className="btn secondary" onClick={() => tailor('groq')}>Use backup AI (Groq)</button></>}>
      {phase.error} Nothing was taken from today's limit. You can always edit the resume yourself.
    </Empty>
  ) : null;

  const left = phase === 'working' ? working : errorCard ? errorCard : !v ? (
    <>{jdPanel}</>
  ) : (
    <>
      <div className="tabs" role="tablist"><button className={`tab ${tab === 'sugg' ? 'on' : ''}`} role="tab" aria-selected={tab === 'sugg'} onClick={() => setTab('sugg')}>Suggestions · {v.suggestions.length + v.questions.filter((q) => q.state === 'open').length}</button><button className={`tab ${tab === 'job' ? 'on' : ''}`} role="tab" aria-selected={tab === 'job'} onClick={() => setTab('job')}>Job description</button></div>
      {tab === 'sugg' ? suggPanel : jdPanel}
    </>
  );

  const tailorBar = !v && phase !== 'working' && !errorCard ? (
    <div className="col" style={{ gap: 8 }}>
      <button className="btn lg full" onClick={startTailor} disabled={!navigator.onLine}><Icon n="wand" s={18} />Tailor resume to this job</button>
      <span className="small" style={{ textAlign: 'center' }}>{navigator.onLine ? `Uses 1 of your ${tailorLeft} tailorings left today. Your master resume stays unchanged.` : 'Tailoring needs internet.'}</span>
    </div>
  ) : null;

  const modals = (
    <>
      {edit ? <EditModal path={edit} r={resume} onSave={saveEdit} onClose={() => setEdit(null)} /> : null}
      {limit ? <LimitModal p={p} u={u} groqOn={groqOn} onClose={() => setLimit(false)} tailor={tailor} /> : null}
      {applyQ ? <ApplyModal job={job} name={applyQ} onClose={() => setApplyQ(null)} onYes={() => { setJobStatus(pid, job, 'applied'); setApplyQ(null); location.hash = '#/jobs?tab=applied'; }} /> : null}
    </>
  );

  if (mobile) {
    if (chat && v) return <ChatPanel mobile pid={pid} id={id} job={job} v={v} refineLeft={refineLeft} onClose={() => { setChat(false); setMtab('resume'); }} />;
    const score = v?.atsAfter && v.suggestions.every((x) => x.state !== 'open') ? v.atsAfter : job.score;
    const applied = p.status[id]?.s === 'applied';
    const jobBody = (
      <>
        {job.emails?.length ? (
          <div className="row" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', flexWrap: 'nowrap' }}>
            <Icon n="mail" s={18} />
            <div className="col" style={{ flex: 1, gap: 0, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.emails[0]}</span><span className="small" style={{ fontSize: 12 }}>Found in the job post</span></div>
            <button className="btn secondary sm" onClick={() => navigator.clipboard?.writeText(job.emails[0])}>Copy</button>
          </div>
        ) : null}
        {v?.missing?.length ? <div className="col" style={{ gap: 6 }}><span className="label" style={{ color: '#8F3412' }}>Missing from your resume</span><div className="row" style={{ gap: 6 }}>{v.missing.map((k) => <span key={k} className="chip acc">{k}</span>)}</div></div> : null}
        {(v?.have?.length ? v.have : job.matched || []).length ? <div className="col" style={{ gap: 6 }}><span className="label" style={{ color: 'var(--ok)' }}>Already in your resume</span><div className="row" style={{ gap: 6 }}>{(v?.have?.length ? v.have : job.matched).map((k) => <span key={k} className="chip ok">{k}</span>)}</div></div> : null}
        {job.short ? (
          <div className="col" style={{ gap: 10 }}>
            <Banner tone="info" icon="info">This source only shows part of the description. Paste the full one for better tailoring.</Banner>
            <textarea className="textarea" rows={4} placeholder="Paste the full job description" value={pasteJD} onChange={(e) => setPasteJD(e.target.value)} aria-label="Full job description" />
            <div><button className="btn secondary sm" disabled={pasteJD.trim().length < 200} onClick={() => { updateProfile(pid, (pp) => { const upd = (j) => { if (j && j.id === id) { j.description = pasteJD.trim(); j.short = false; } }; pp.feed?.list.forEach(upd); pp.feed?.close.forEach(upd); upd(pp.jobCache[id]); }); setPasteJD(''); }}>Use this description</button></div>
          </div>
        ) : null}
        <h2 style={{ fontSize: 16 }}>About the role</h2>
        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{job.description || 'No description was provided. Open the original posting to read it.'}</div>
        {applied ? <span className="chip ok" style={{ alignSelf: 'flex-start' }}>Applied</span> : <button className="btn secondary" onClick={() => { setJobStatus(pid, job, 'applied'); location.hash = '#/jobs?tab=applied'; }}>Mark as applied</button>}
      </>
    );
    const resumeBody = (
      <>
        {v ? suggPanel : null}
        {over ? <Banner action={v && refineLeft ? <button className="btn secondary sm" onClick={askTrims} disabled={trims === 'loading'}>{trims === 'loading' ? 'Thinking…' : 'Suggest trims'}</button> : null}><b>Runs onto a second page</b> by about {fit.overLines} lines. Download unlocks once it fits.</Banner> : null}
        {Array.isArray(trims) && over ? trims.map((t, i) => <div key={i} className="sugg"><b style={{ color: 'var(--ink)', fontSize: 14 }}>{t.title}</b><span className="small">{t.detail}</span><div><button className="btn sm" onClick={() => { applyTrim(t); setTrims(null); }}>Apply trim</button></div></div>) : null}
        {trims?.error ? <Banner tone="err">{trims.error}</Banner> : null}
        <div className="between"><span className="label">{v ? 'Preview · tap a line to edit' : 'Your master resume · tap a line to edit'}</span>{v?.undo?.length ? <button className="btn ghost sm" onClick={undo}><Icon n="undo" s={16} />Undo</button> : null}</div>
        <ResumeView r={resume} highlight={highlight} onEdit={(path) => setEdit(path)} onFit={onFit} dim={phase === 'working'} />
      </>
    );
    const onResume = mtab === 'resume';
    return (
      <div className="app" style={{ background: onResume ? 'var(--bg)' : '#fff' }}>
        <AppBar back="#/jobs" title={onResume && v ? 'Tailored resume' : job.title} sub={onResume && v ? `${job.company} · ${v.atsBefore || job.score}% → ${v.atsAfter || score}%` : `${job.company} · ${job.location} · ${job.mode}`}>
          {onResume ? (
            <button className="btn sm" onClick={download} disabled={pdfBusy || over} aria-label="Download PDF"><Icon n="download" s={16} />{pdfBusy ? '…' : 'PDF'}</button>
          ) : (
            <>
              {!p.status[id] ? <button className="iconbtn" aria-label="Skip this job" onClick={() => { setJobStatus(pid, job, 'skipped'); location.hash = '#/jobs'; }}><Icon n="x" /></button> : null}
            </>
          )}
        </AppBar>
        <div className="col" style={{ padding: '12px 16px 0', gap: 10, background: '#fff' }}>
          {!onResume ? <div className="row" style={{ gap: 6 }}><Score n={score} /><span className="chip ink">{job.salary}</span>{job.expText ? <span className="chip">{job.expText}</span> : null}<span className="chip">{job.ago ? `${job.ago} · ` : ''}{job.source}</span></div> : null}
          {!onResume && job.url ? <a href={job.url} target="_blank" rel="noreferrer" className="row" style={{ gap: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none', flexWrap: 'nowrap' }}><Icon n="ext" s={16} />View the original job post</a> : null}
          <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
            <button role="tab" aria-selected={!onResume} className={!onResume ? 'on' : ''} onClick={() => setMtab('job')}>Job</button>
            <button role="tab" aria-selected={onResume} className={onResume ? 'on' : ''} onClick={() => setMtab('resume')}>{v ? 'Tailored resume' : 'Resume'}</button>
          </div>
        </div>
        <main className="col" style={{ flex: 1, padding: '14px 16px 24px', gap: 12, paddingBottom: onResume && v ? 96 : 24 }}>
          {phase === 'working' ? working : errorCard || (onResume ? resumeBody : jobBody)}
        </main>
        {!v && phase !== 'working' && !errorCard ? (
          <div className="actionbar">
            <button className="btn lg full" onClick={startTailor} disabled={!navigator.onLine}><Icon n="wand" s={18} />Tailor resume to this job</button>
            <span className="small" style={{ textAlign: 'center', fontSize: 12 }}>{navigator.onLine ? `Uses 1 of ${tailorLeft} tailorings left today` : 'Tailoring needs internet.'}</span>
          </div>
        ) : null}
        {v && !onResume ? <div className="actionbar"><button className="btn lg full" onClick={() => setMtab('resume')}><Icon n="file" s={18} />View tailored resume</button></div> : null}
        {v && onResume && phase !== 'working' ? <button className="fab" onClick={() => setChat(true)}><Icon n="chat" s={18} />Refine</button> : null}
        {modals}
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar pid={pid} route={route} back={back} />
      {chat && v ? (
        <div className="split">
          <section className="l">{resumePanel}</section>
          <section className="r"><ChatPanel pid={pid} id={id} job={job} v={v} refineLeft={refineLeft} onClose={() => setChat(false)} onEditSelf={() => { setChat(false); }} /></section>
        </div>
      ) : (
        <div className={v || phase ? 'split flip' : 'split'}>
          <section className="l">{left}</section>
          <section className="r">{tailorBar}{resumePanel}</section>
        </div>
      )}
      {v && !chat ? <button className="fab" onClick={() => setChat(true)}><Icon n="chat" s={18} />Refine with chat</button> : null}

      {modals}
    </div>
  );
}

function LimitModal({ p, u, groqOn, onClose, tailor }) {
  return (
    <Modal onClose={onClose} labelledBy="lim">
      <h2 id="lim">{u.tailor >= p.limits.tailorPerDay ? `You've used today's ${p.limits.tailorPerDay} tailorings` : "Gemini's free tailoring limit is used up for today"}</h2>
      <p className="sub">You can still tailor with a backup model. Results may be a little less polished, so review them closely.</p>
      <div className="col" style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, fontSize: 14 }}>
        <div className="between"><span>Gemini Flash (tailoring)</span><b style={{ color: 'var(--err)' }}>Used up · resets in {formatDuration(msUntilQuotaReset())}</b></div>
        <div className="between"><span>Gemini Flash-Lite</span><b style={{ color: 'var(--ok)' }}>{Math.max(0, p.limits.refinePerDay - u.refine)} left</b></div>
        <div className="between"><span>Groq</span><b style={{ color: groqOn ? 'var(--ok)' : 'var(--mut)' }}>{groqOn ? 'Available' : 'Not set up'}</b></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onClose}>Wait till tomorrow</button>
        {groqOn ? <button className="btn secondary" onClick={() => tailor('groq')}>Use Groq</button> : null}
        <button className="btn" onClick={() => tailor('refine')}>Use Flash-Lite</button>
      </div>
    </Modal>
  );
}

function ApplyModal({ job, name, onClose, onYes }) {
  return (
    <Modal onClose={onClose} labelledBy="applyq">
      <div className="row" style={{ background: '#F2FAF5', borderRadius: 12, padding: 12, flexWrap: 'nowrap' }}><span style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: 'var(--okbg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="check" s={18} w={3} c="var(--ok)" /></span><div className="col" style={{ gap: 2, minWidth: 0 }}><b style={{ color: 'var(--ink)', fontSize: 14 }}>PDF saved</b><span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span></div></div>
      <h2 id="applyq">Did you apply to this job?</h2>
      {job.url ? <a href={job.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Open the posting to apply ↗</a> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={onClose}>Not yet, keep it in New</button><button className="btn" onClick={onYes}>Yes, mark as applied</button></div>
    </Modal>
  );
}

function EditModal({ path, r, onSave, onClose }) {
  const [t, setT] = useState(getPath(r, path) || '');
  return (
    <Modal onClose={onClose} labelledBy="edl">
      <div className="between"><h2 id="edl" style={{ fontSize: 20 }}>Edit: {pathLabel(r, path)}</h2><span className="small">No AI used</span></div>
      <textarea className="textarea" rows={path === 'summary' ? 6 : 4} value={t} onChange={(e) => setT(e.target.value)} aria-label="Text" />
      <span className="small">Use **double asterisks** to bold a number.</span>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={() => onSave(path, t)} disabled={!t.trim()}>Save</button></div>
    </Modal>
  );
}

function ChatPanel({ pid, id, job, v, refineLeft, onClose, mobile }) {
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const box = useRef(null);
  const per = useStore((s) => s.profiles[pid].limits.refinePerJob);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [v.chat?.length, busy]);
  useEffect(() => { if (!mobile) return undefined; const f = (e) => { e.preventDefault(); onClose(); }; addEventListener('appback', f); return () => removeEventListener('appback', f); }, [mobile, onClose]);
  const add = (t) => setMsg((m) => (m.trim() ? `${m.trim()}\n${t}` : t));

  async function send() {
    const text = msg.trim(); if (!text || busy || !refineLeft) return;
    setBusy(true); setErr(null);
    saveVersion(pid, id, (vv) => { vv.chat = [...(vv.chat || []), { role: 'me', text }]; });
    try {
      const { system, user } = refinePrompt(v.resume, job, v.chat || [], text);
      const out = await callAI(pid, 'refine', system, user);
      saveVersion(pid, id, (vv) => {
        const before = vv.resume; let r = vv.resume; const changed = [];
        (out.changes || []).forEach((c) => { if (validPath(r, c.path) && c.after) { r = setPath(r, c.path, stripDashes(dropLabel(r, c.path, c.after))); changed.push(c.path); } });
        (out.moves || []).forEach((m) => {
          const list = r[m.section]?.[m.index]?.bullets;
          if (list && list[m.from] && m.to >= 0 && m.to < list.length) { r = structuredClone(r); const arr = r[m.section][m.index].bullets; const [b] = arr.splice(m.from, 1); arr.splice(m.to, 0, b); }
        });
        vv.undo = [...(vv.undo || []), before].slice(-10);
        vv.resume = r; vv.changed = [...new Set([...(vv.changed || []), ...changed])];
        vv.refineUsed = (vv.refineUsed || 0) + 1;
        vv.chat = [...vv.chat, { role: 'ai', text: stripDashes(out.reply || 'Done.'), snap: before }];
      });
      setMsg('');
    } catch (e) {
      saveVersion(pid, id, (vv) => { vv.chat = vv.chat.slice(0, -1); });
      setErr(e.message || 'Something went wrong. Nothing was used.');
    } finally { setBusy(false); }
  }
  const undoMsg = (i) => saveVersion(pid, id, (vv) => { const m = vv.chat[i]; if (m?.snap) { vv.resume = m.snap; vv.chat[i] = { ...m, snap: null, undone: true }; } });

  const used = per - refineLeft; const pct = Math.round((refineLeft / per) * 100);
  return (
    <aside className={mobile ? 'mchat' : 'chat'} aria-label="Refine with chat">
      {mobile ? (
        <>
          <AppBar onBack={onClose} title="Refine resume" sub={`${job.company} only`}>
            <div className="col" style={{ alignItems: 'flex-end', gap: 4, paddingRight: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: refineLeft ? 'var(--ink)' : 'var(--err)' }}>{refineLeft} of {per} left</span><div className="meter"><div style={{ width: `${pct}%`, background: refineLeft ? undefined : 'var(--err)' }} /></div></div>
          </AppBar>
          <button onClick={onClose} className="row" style={{ margin: '12px 16px 0', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', flexWrap: 'nowrap', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 32, height: 42, flex: 'none', borderRadius: 4, background: '#fff', border: '1px solid var(--line)', borderTop: '3px solid var(--acc)' }} />
            <span className="col" style={{ flex: 1, gap: 2 }}><b style={{ fontSize: 13, color: 'var(--ink)' }}>View updated resume</b><span className="small" style={{ fontSize: 12 }}>{(v.changed || []).length} changes so far</span></span>
            <Icon n="chev" s={18} c="var(--mut)" />
          </button>
        </>
      ) : <div className="between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
        <div className="col" style={{ gap: 2 }}><span style={{ ...H, fontSize: 16 }}>Refine this resume</span><span className="small">For {job.company} only</span></div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: refineLeft ? 'var(--ink)' : 'var(--err)' }}>{refineLeft} of {per} refinements left</span><div className="meter"><div style={{ width: `${pct}%`, background: refineLeft ? undefined : 'var(--err)' }} /></div></div>
        <button className="iconbtn" aria-label="Close chat" onClick={onClose}><Icon n="x" s={18} /></button>
      </div>}
      <div className="msgs" ref={box}>
        {!v.chat?.length ? <div className="small" style={{ textAlign: 'center', padding: '24px 8px' }}>Ask for everything you want changed in one message, for example: “1) Shorten the summary 2) Move the Power BI bullet first 3) Use the word stakeholders”.</div> : null}
        {(v.chat || []).map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'me' ? 'me' : 'ai'}`}>{m.text}
            {m.role === 'ai' && m.snap ? <div style={{ marginTop: 8 }}><button className="btn secondary sm" onClick={() => undoMsg(i)}><Icon n="undo" s={16} />Undo these changes</button></div> : null}
            {m.undone ? <div className="small" style={{ marginTop: 6 }}>Changes undone</div> : null}
          </div>
        ))}
        {busy ? <div className="bubble ai"><span className="spinner" style={{ width: 18, height: 18, borderWidth: 3, display: 'inline-block', verticalAlign: 'middle' }} /> Updating your resume…</div> : null}
        {!refineLeft ? <div className="row" style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon n="lock" c="var(--mut)" /><span style={{ fontSize: 14 }}><b style={{ color: 'var(--ink)' }}>No refinements left{used >= per ? ' for this job' : ' today'}.</b> You can still click any line in the resume to edit it yourself.</span></div> : null}
      </div>
      <div className="col" style={{ padding: mobile ? '12px 14px calc(16px + env(safe-area-inset-bottom))' : '12px 14px 16px', borderTop: '1px solid var(--line)', gap: 10 }}>
        {err ? <Banner tone="err">{err}</Banner> : null}
        {refineLeft ? <>
          <div className="row" style={{ background: 'var(--bluebg)', color: 'var(--blue)', borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon n="chat" s={16} /><span><b>Put all your changes in one message.</b> Each send uses 1 of your {refineLeft} refinements left for this job.</span></div>
          <div className="row" style={{ gap: 6 }}>{['Shorter summary', 'More JD keywords', 'Move my strongest bullet up'].map((c) => <button key={c} className="pill" style={{ borderStyle: 'dashed', cursor: 'pointer' }} onClick={() => add(c)}>+ {c}</button>)}</div>
        </> : null}
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <textarea className="textarea" rows={3} style={{ minHeight: 0 }} aria-label="Your changes" disabled={!refineLeft || busy} placeholder={refineLeft ? 'e.g. 1) Shorten the summary  2) Move a bullet up  3) Use the word stakeholders' : 'No refinements left'} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
          <button className="btn" style={{ width: 48, padding: 0, background: refineLeft ? 'var(--acc)' : undefined, color: 'var(--ink)' }} aria-label="Send" onClick={send} disabled={!refineLeft || busy || !msg.trim()}><Icon n="send" /></button>
        </div>
      </div>
    </aside>
  );
}
