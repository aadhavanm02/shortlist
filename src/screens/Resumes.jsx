import { useState } from 'react';
import { useStore, updateProfile } from '../lib/store.js';
import { TopBar, Icon, Empty, Modal, useMobile } from '../components/ui.jsx';
import { findJob } from '../lib/jobs.js';
import { buildPdf, downloadBlob } from '../lib/pdfDoc.jsx';

export default function Resumes({ pid, route }) {
  const mobile = useMobile();
  const p = useStore((s) => s.profiles[pid]);
  const [busy, setBusy] = useState(null);
  const [del, setDel] = useState(null);
  const versions = Object.entries(p.versions).map(([id, v]) => ({ id, v, job: findJob(p, id) })).sort((a, b) => (b.v.createdAt || 0) - (a.v.createdAt || 0));
  const dl = async (r, name, key) => { setBusy(key); try { const { blob } = await buildPdf(r); downloadBlob(blob, name); } finally { setBusy(null); } };
  const date = (t) => (t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
  const thumb = <div style={{ width: 36, height: 46, flex: 'none', borderRadius: 4, border: '1px solid var(--line)', borderTop: '3px solid var(--acc)' }} />;
  return (
    <div className="app">
      <TopBar pid={pid} route={route} title="Resumes" sub="Every tailored version is kept here" />
      <main className="main">
        {mobile ? null : <div className="col" style={{ gap: 6 }}><h1 className="title">Resumes</h1><p className="sub">Your master resume and every tailored version.</p></div>}
        {p.resume ? (
          <div className="card tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {thumb}
            <div className="col" style={{ flex: 1, gap: 4, minWidth: 0 }}><div className="row"><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.resume.name}</span><span className="chip acc">Master</span></div><span className="small">{p.resumeUpdated ? `Edited ${date(p.resumeUpdated)} · ` : ''}the base for every tailored version</span></div>
            <a className="btn secondary sm" href="#/resumes/master"><Icon n="pencil" s={16} />Edit</a>
            <button className="btn secondary sm" onClick={() => dl(p.resume, `Resume - ${p.resume.name}.pdf`, 'm')} disabled={busy === 'm'}><Icon n="download" s={16} />{busy === 'm' ? '…' : 'PDF'}</button>
          </div>
        ) : null}
        <span className="label" style={{ marginTop: 8 }}>Tailored versions</span>
        {versions.length ? versions.map(({ id, v, job }) => (
          <div key={id} className="card tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {thumb}
            <div className="col" style={{ flex: 1, gap: 4, minWidth: 0 }}><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{job?.company || 'Job'}</span><span className="small">{job?.title || ''} · {date(v.createdAt)}{v.atsAfter ? ` · ${v.atsAfter}% match` : ''}{p.status[id]?.s === 'applied' ? ' · Applied' : ''}</span></div>
            {job ? <a className="btn secondary sm hide-sm" href={`#/job/${id}`}>Open</a> : null}
            <button className="btn secondary sm" onClick={() => dl(v.resume, `Resume - ${v.resume.name} - ${job?.company || 'Tailored'}.pdf`, id)} disabled={busy === id}><Icon n="download" s={16} />{busy === id ? '…' : 'PDF'}</button>
            <button className="iconbtn" aria-label={`Delete version for ${job?.company || 'job'}`} onClick={() => setDel(id)}><Icon n="x" s={18} /></button>
          </div>
        )) : <Empty icon="search" title="No tailored resumes yet">Open a job and tap “Tailor resume to this job”. Every version you make is kept here.</Empty>}
      </main>
      {del ? (
        <Modal onClose={() => setDel(null)} labelledBy="delv">
          <h2 id="delv">Delete this tailored version?</h2><p className="sub">The job stays in your lists. You can tailor it again later.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn secondary" onClick={() => setDel(null)}>Cancel</button><button className="btn dangerfill" onClick={() => { updateProfile(pid, (pp) => { delete pp.versions[del]; }); setDel(null); }}>Delete</button></div>
        </Modal>
      ) : null}
    </div>
  );
}
