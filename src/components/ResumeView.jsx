// Live A4 preview of the resume (same design as the PDF). Lines are clickable to edit.
import { useLayoutEffect, useRef, useState } from 'react';
import { segments } from '../lib/resume.js';

const PT = 96 / 72;               // px per pt
const SIZES = [10.6, 10.3, 10, 9.7, 9.4, 9.1, 8.8];
const CLASSIC_SIZES = [10, 9.7, 9.4, 9.1, 8.8, 8.5];
const ACC = '#F06434', INK = '#1F1D24', MUT = '#6A6670', LINE = '#E6E3E8', PILL = '#FDEBE3', DOT = '#A9A6AE';
const plain = (t) => segments(t).map((x) => x.t).join('');
const PAGE_H = 1123;              // A4 height at 96 dpi

function Rich({ text }) {
  return segments(text).map((s, i) => (s.b ? <b key={i} style={{ color: '#1F1D24' }}>{s.t}</b> : <span key={i}>{s.t}</span>));
}

export default function ResumeView({ r, highlight = [], focus = null, onEdit, onFit, dim = false }) {
  const wrap = useRef(null); const paper = useRef(null);
  const classic = r.template === 'classic';
  const sizes = classic ? CLASSIC_SIZES : SIZES;
  const [scale, setScale] = useState(0.6); const [size, setSize] = useState(sizes[0]); const [over, setOver] = useState(0);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => { if (wrap.current) setScale(wrap.current.clientWidth / 794); });
    ro.observe(wrap.current); return () => ro.disconnect();
  }, []);

  // find the largest size that fits one page, like the PDF does
  useLayoutEffect(() => {
    const el = paper.current; if (!el) return;
    let chosen = sizes[sizes.length - 1]; let overPx = 0;
    for (const s of sizes) {
      el.style.setProperty('--fs', `${s * PT}px`);
      if (el.scrollHeight <= PAGE_H) { chosen = s; overPx = 0; break; }
      overPx = el.scrollHeight - PAGE_H;
    }
    el.style.setProperty('--fs', `${chosen * PT}px`);
    const lines = overPx ? Math.max(1, Math.round(overPx / (chosen * PT * 1.45))) : 0;
    setSize(chosen); setOver(lines); onFit?.({ size: chosen, overLines: lines });
  }, [r]); // eslint-disable-line react-hooks/exhaustive-deps

  const hl = new Set(highlight);
  const E = ({ path, children, block }) => {
    if (!path) return block ? <div>{children}</div> : <span>{children}</span>;
    const cls = [onEdit ? 'editable' : '', hl.has(path) ? 'hl' : ''].join(' ');
    const style = focus === path ? { outline: '2px solid #F06434', outlineOffset: 3 } : undefined;
    const Tag = block ? 'div' : 'span';
    return onEdit ? <Tag className={cls} style={style} role="button" tabIndex={0} title="Click to edit" onClick={() => onEdit(path)} onKeyDown={(e) => { if (e.key === 'Enter') onEdit(path); }}>{children}</Tag> : <Tag className={cls} style={style}>{children}</Tag>;
  };
  const pill = (t) => <span style={{ fontWeight: 700, fontSize: 'calc(var(--fs) * .86)', color: ACC, background: PILL, borderRadius: 999, padding: '1px 9px', whiteSpace: 'nowrap', flex: 'none' }}>{t}</span>;
  const ul = { color: INK, fontWeight: 700, textDecoration: 'underline' };
  const emailHref = r.emailUrl || `mailto:${r.email}`;

  const studio = () => {
    const sec = (t, right) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${LINE}`, paddingBottom: 5, margin: 'calc(var(--fs) * 1.25) 0 calc(var(--fs) * .7)' }}><span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * .95)', letterSpacing: 1.3, textTransform: 'uppercase', color: INK }}>{t}</span>{right}</div>;
    const bullets = (sectionKey, i, list) => list.map((b, j) => (
      <div key={j} style={{ display: 'flex', gap: 9, marginBottom: 'calc(var(--fs) * .32)', paddingLeft: 3 }}>
        <span style={{ width: 4, height: 4, borderRadius: 3, background: DOT, marginTop: 'calc(var(--fs) * .65)', flex: 'none' }} />
        <E path={sectionKey === 'experience' ? `${sectionKey}.${i}.bullets.${j}.text` : null}>{b.label ? <b style={{ color: INK }}>{b.label}: </b> : null}<Rich text={b.text} /></E>
      </div>
    ));
    return (<>
      <div style={{ height: 7, margin: '0 -53px 40px', background: 'linear-gradient(90deg,#F06434 0%,#F5A27F 60%,#F9C9B4 100%)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${LINE}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 33, color: INK, letterSpacing: -0.5, lineHeight: 1.1 }}>{r.name || 'Your name'}</div>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: MUT, marginTop: 5 }}>{r.title}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'calc(var(--fs) * .92)', lineHeight: 1.6 }}>
          {r.phone ? <div>{r.phone}</div> : null}
          {r.links.map((l, i) => <div key={i}><a href={l.url} target="_blank" rel="noreferrer" style={ul}>{l.label}</a></div>)}
          {r.email ? <div><a href={emailHref} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{r.email}</a></div> : null}
        </div>
      </div>
      {r.summary ? <div style={{ marginTop: 14 }}><E path="summary" block><Rich text={r.summary} /></E></div> : null}
      {r.experience.length ? sec('Professional Experience') : null}
      {r.experience.map((e, i) => (
        <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .9)' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * 1.02)', color: INK }}>{e.role}{e.company ? ', ' : ''}{e.company ? <span style={{ color: ACC }}>{e.company}</span> : null}</span>
            {e.dates ? pill(e.dates) : null}
          </div>
          {bullets('experience', i, e.bullets)}
        </div>
      ))}
      {r.projects.length ? sec('Projects') : null}
      {r.projects.map((p, i) => (
        <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .7)' : 0 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 800, color: INK, marginBottom: 4 }}>{p.name}</div>
          {bullets('projects', i, p.bullets)}
        </div>
      ))}
      {r.education.length ? sec('Education') : null}
      {r.education.map((e, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * 1.02)', color: INK }}>{e.school}</span>{e.dates ? pill(e.dates) : null}</div>
          <div style={{ color: MUT, marginTop: 2 }}>{e.degree}</div>
        </div>
      ))}
      {r.skills.length ? sec('Skills', r.skillsLink?.url ? <a href={r.skillsLink.url} target="_blank" rel="noreferrer" style={{ ...ul, fontWeight: 600, fontSize: 'calc(var(--fs) * .82)' }}>{r.skillsLink.label || 'Proof of Skills'}</a> : null) : null}
      {r.skills.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 0, marginBottom: 'calc(var(--fs) * .35)' }}>
          <b style={{ width: 152, flex: 'none', color: INK }}>{s.label}</b><E path={`skills.${i}.items`}>{s.items}</E>
        </div>
      ))}
    </>);
  };

  const classicView = () => {
    const K = '#000';
    const sec = (t) => <div style={{ borderBottom: `1.2px solid ${K}`, paddingBottom: 2, margin: 'calc(var(--fs) * 1.15) 0 calc(var(--fs) * .4)', fontWeight: 700, color: K }}>{t.toUpperCase()}:</div>;
    const dot = (w) => <span style={{ width: w, flex: 'none', display: 'flex', justifyContent: 'center', paddingTop: 'calc(var(--fs) * .55)' }}><span style={{ width: 5, height: 5, borderRadius: 3, background: K }} /></span>;
    const bullets = (sectionKey, i, list) => list.map((b, j) => (
      <div key={j} style={{ display: 'flex', marginBottom: 2, paddingLeft: 19 }}>{dot(29)}
        <E path={sectionKey === 'experience' ? `${sectionKey}.${i}.bullets.${j}.text` : null}>{b.label ? `${b.label}: ` : ''}{plain(b.text)}</E>
      </div>
    ));
    const per = Math.ceil(r.skills.length / 4) || 1;
    const cols = [0, 1, 2, 3].map((c) => r.skills.map((s, i) => [s, i]).slice(c * per, c * per + per));
    return (<div style={{ paddingTop: 45, color: K, lineHeight: 1.4 }}>
      <div style={{ fontWeight: 700, fontSize: 25, marginBottom: 8 }}>{r.name || 'Your name'}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', lineHeight: 1.35 }}>
        <div>
          {r.email ? <div>{r.emailUrl ? <a href={r.emailUrl} target="_blank" rel="noreferrer" style={{ color: K, textDecoration: 'none' }}>{r.email}</a> : r.email}</div> : null}
          {r.links.map((l, i) => <div key={i}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#1155CC', textDecoration: 'underline' }}>{l.url}</a></div>)}
        </div>
        <div style={{ textAlign: 'right' }}>{r.phone ? <div>{r.phone}</div> : null}{r.location ? <div>{r.location}</div> : null}</div>
      </div>
      {r.summary ? <>{sec('Summary')}<E path="summary" block>{plain(r.summary)}</E></> : null}
      {r.skills.length ? <>{sec('Skills')}<div style={{ display: 'flex' }}>{cols.map((c, ci) => (
        <div key={ci} style={{ flex: 1, paddingRight: 8 }}>{c.map(([s, i]) => (
          <div key={i} style={{ display: 'flex', lineHeight: 1.3 }}>{dot(16)}<E path={`skills.${i}.items`}>{s.label ? `${s.label}: ` : ''}{s.items}</E></div>
        ))}</div>
      ))}</div></> : null}
      {r.experience.length ? sec('Experience') : null}
      {r.experience.map((e, i) => (
        <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .6)' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}><b>{e.company}{e.company && e.role ? ' – ' : ''}{e.role}</b><span style={{ whiteSpace: 'nowrap' }}>{e.dates}</span></div>
          {bullets('experience', i, e.bullets)}
        </div>
      ))}
      {r.projects.length ? sec('Project') : null}
      {r.projects.map((p, i) => (
        <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .4)' : 0 }}><b style={{ display: 'block', marginBottom: 2 }}>{p.name}:</b>{bullets('projects', i, p.bullets)}</div>
      ))}
      {r.education.length ? sec('Education') : null}
      {r.education.map((e, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{e.degree}{e.degree && e.school ? ' - ' : ''}{e.school}</span><span style={{ whiteSpace: 'nowrap' }}>{e.dates}</span></div>
      ))}
    </div>);
  };

  return (
    <div className="paper-wrap" ref={wrap} style={{ height: PAGE_H * scale + (over ? 40 : 0), opacity: dim ? 0.55 : 1 }}>
      <div className="paper" ref={paper} style={{ transform: `scale(${scale})`, '--fs': `${size * PT}px`, fontSize: 'var(--fs)', lineHeight: 1.45, padding: classic ? '0 45px 40px' : '0 53px 40px', height: 'auto' }}>
        {classic ? classicView() : studio()}
      </div>
      {over ? <div className="pagebreak" style={{ top: PAGE_H * scale }}><span>Page 2 starts here · about {over} lines over</span></div> : null}
    </div>
  );
}
