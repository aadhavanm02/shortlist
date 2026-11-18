import { useState } from 'react';
import { useStore, updateProfile } from '../lib/store.js';
import { TopBar, Field, Banner, Icon } from '../components/ui.jsx';
import ResumeView from '../components/ResumeView.jsx';
import { normalizeResume, EMPTY_RESUME } from '../lib/resume.js';
import { buildPdf, downloadBlob } from '../lib/pdfDoc.jsx';

export default function MasterEditor({ pid, route }) {
  const p = useStore((s) => s.profiles[pid]);
  const [r, setR] = useState(() => normalizeResume(p.resume || EMPTY_RESUME));
  const [saved, setSaved] = useState(true);
  const [fit, setFit] = useState({ overLines: 0 });
  const [busy, setBusy] = useState(false);
  const up = (fn) => { setR((x) => { const c = structuredClone(x); fn(c); return c; }); setSaved(false); };

  const save = () => { updateProfile(pid, (pp) => { pp.resume = r; pp.resumeUpdated = Date.now(); }); setSaved(true); };
  const dl = async () => { setBusy(true); try { const { blob } = await buildPdf(r); downloadBlob(blob, `Resume - ${r.name}.pdf`); } finally { setBusy(false); } };

  const inp = (val, on, ph = '', aria) => <input className="input" value={val} placeholder={ph} aria-label={aria || ph} onChange={(e) => on(e.target.value)} />;
  const ta = (val, on, aria, rows = 3) => <textarea className="textarea" rows={rows} style={{ minHeight: 0 }} value={val} aria-label={aria} onChange={(e) => on(e.target.value)} />;
  const rm = (fn, label) => <button className="iconbtn" aria-label={label} onClick={fn}><Icon n="x" s={18} /></button>;

  return (
    <div className="app">
      <TopBar pid={pid} route={route} back={{ href: '#/resumes', label: 'Resumes' }} title="Master resume" sub="Edits here apply to every new tailoring" />
      <div className="split flip">
        <section className="l">
          <div className="between"><h1 className="title" style={{ fontSize: 26 }}>Master resume</h1><div className="row"><button className="btn sm" onClick={save} disabled={saved}>{saved ? 'Saved' : 'Save changes'}</button></div></div>
          <p className="sub">Every tailored version starts from this. Use **double asterisks** to bold a number. Manual edits never use AI.</p>
          <div className="card" style={{ gap: 14 }}>
            <div className="grid2" style={{ gap: 12 }}>{inp(r.name, (v) => up((c) => { c.name = v; }), 'Name')}{inp(r.title, (v) => up((c) => { c.title = v; }), 'Title')}{inp(r.phone, (v) => up((c) => { c.phone = v; }), 'Phone')}{inp(r.email, (v) => up((c) => { c.email = v; }), 'Email')}</div>
            <span className="label">Links</span>
            {r.links.map((l, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>{inp(l.label, (v) => up((c) => { c.links[i].label = v; }), 'Label, e.g. Portfolio')}{inp(l.url, (v) => up((c) => { c.links[i].url = v; }), 'https://')}{rm(() => up((c) => { c.links.splice(i, 1); }), 'Remove link')}</div>)}
            <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => up((c) => { c.links.push({ label: 'Portfolio', url: '' }); })}><Icon n="plus" s={16} />Add link</button>
            <Field label="Summary">{ta(r.summary, (v) => up((c) => { c.summary = v; }), 'Summary', 4)}</Field>
          </div>
          {['experience', 'projects'].map((sec) => (
            <div key={sec} className="card" style={{ gap: 14 }}>
              <span className="label">{sec === 'experience' ? 'Experience' : 'Projects'}</span>
              {r[sec].map((e, i) => (
                <div key={i} className="col" style={{ gap: 10, borderTop: i ? '1px solid var(--line)' : 0, paddingTop: i ? 14 : 0 }}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {sec === 'experience' ? <>{inp(e.role, (v) => up((c) => { c[sec][i].role = v; }), 'Role')}{inp(e.company, (v) => up((c) => { c[sec][i].company = v; }), 'Company')}{inp(e.dates, (v) => up((c) => { c[sec][i].dates = v; }), 'Dates')}</> : inp(e.name, (v) => up((c) => { c[sec][i].name = v; }), 'Project name')}
                    {rm(() => up((c) => { c[sec].splice(i, 1); }), `Remove ${sec === 'experience' ? 'role' : 'project'}`)}
                  </div>
                  {e.bullets.map((b, j) => (
                    <div key={j} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                      <input className="input" style={{ width: 170, flex: 'none' }} value={b.label} placeholder="Label (optional)" aria-label="Bullet label" onChange={(ev) => up((c) => { c[sec][i].bullets[j].label = ev.target.value; })} />
                      {ta(b.text, (v) => up((c) => { c[sec][i].bullets[j].text = v; }), 'Bullet text', 2)}
                      {rm(() => up((c) => { c[sec][i].bullets.splice(j, 1); }), 'Remove bullet')}
                    </div>
                  ))}
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => up((c) => { c[sec][i].bullets.push({ label: '', text: '' }); })}><Icon n="plus" s={16} />Add bullet</button>
                </div>
              ))}
              <button className="btn secondary sm" style={{ alignSelf: 'flex-start' }} onClick={() => up((c) => { c[sec].push(sec === 'experience' ? { role: '', company: '', dates: '', bullets: [] } : { name: '', bullets: [] }); })}><Icon n="plus" s={16} />Add {sec === 'experience' ? 'role' : 'project'}</button>
            </div>
          ))}
          <div className="card" style={{ gap: 12 }}>
            <span className="label">Education</span>
            {r.education.map((e, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>{inp(e.school, (v) => up((c) => { c.education[i].school = v; }), 'School')}{inp(e.degree, (v) => up((c) => { c.education[i].degree = v; }), 'Degree')}{inp(e.dates, (v) => up((c) => { c.education[i].dates = v; }), 'Dates')}{rm(() => up((c) => { c.education.splice(i, 1); }), 'Remove education')}</div>)}
            <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => up((c) => { c.education.push({ school: '', degree: '', dates: '' }); })}><Icon n="plus" s={16} />Add education</button>
          </div>
          <div className="card" style={{ gap: 12 }}>
            <span className="label">Skills</span>
            {r.skills.map((s, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input className="input" style={{ width: 170, flex: 'none' }} value={s.label} aria-label="Skill group" placeholder="Group, e.g. Tools" onChange={(e) => up((c) => { c.skills[i].label = e.target.value; })} />{ta(s.items, (v) => up((c) => { c.skills[i].items = v; }), 'Skills, comma separated', 2)}{rm(() => up((c) => { c.skills.splice(i, 1); }), 'Remove skill group')}</div>)}
            <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => up((c) => { c.skills.push({ label: '', items: '' }); })}><Icon n="plus" s={16} />Add skill group</button>
            <div className="grid2" style={{ gap: 12 }}>{inp(r.skillsLink?.label || '', (v) => up((c) => { c.skillsLink = { ...(c.skillsLink || {}), label: v }; }), 'Skills link label, e.g. Proof of Skills')}{inp(r.skillsLink?.url || '', (v) => up((c) => { c.skillsLink = { ...(c.skillsLink || {}), url: v }; }), 'Skills link URL')}</div>
          </div>
        </section>
        <section className="r" style={{ position: 'sticky', top: 84 }}>
          <div className="between"><span style={{ fontFamily: 'var(--h)', fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>Preview</span><button className="btn secondary sm" onClick={dl} disabled={busy || fit.overLines > 0}><Icon n="download" s={16} />{busy ? 'Making PDF…' : 'Download PDF'}</button></div>
          {fit.overLines ? <Banner>This runs onto a second page by about {fit.overLines} lines. Shorten a few bullets.</Banner> : null}
          <ResumeView r={r} onFit={(f) => setFit((o) => (o.overLines === f.overLines ? o : f))} />
        </section>
      </div>
    </div>
  );
}
