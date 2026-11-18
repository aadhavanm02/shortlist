// Live A4 preview of the resume (same design as the PDF). Lines are clickable to edit.
import { useLayoutEffect, useRef, useState } from 'react';
import { segments } from '../lib/resume.js';

const PT = 96 / 72;               // px per pt
const SIZES = [10.6, 10.3, 10, 9.7, 9.4, 9.1, 8.8];
const PAGE_H = 1123;              // A4 height at 96 dpi

function Rich({ text }) {
  return segments(text).map((s, i) => (s.b ? <b key={i} style={{ color: '#1F1D24' }}>{s.t}</b> : <span key={i}>{s.t}</span>));
}

export default function ResumeView({ r, highlight = [], focus = null, onEdit, onFit, dim = false }) {
  const wrap = useRef(null); const paper = useRef(null);
  const [scale, setScale] = useState(0.6); const [size, setSize] = useState(10.6); const [over, setOver] = useState(0);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => { if (wrap.current) setScale(wrap.current.clientWidth / 794); });
    ro.observe(wrap.current); return () => ro.disconnect();
  }, []);

  // find the largest size that fits one page, like the PDF does
  useLayoutEffect(() => {
    const el = paper.current; if (!el) return;
    let chosen = SIZES[SIZES.length - 1]; let overPx = 0;
    for (const s of SIZES) {
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
    const cls = [onEdit ? 'editable' : '', hl.has(path) ? 'hl' : ''].join(' ');
    const style = focus === path ? { outline: '2px solid #F06434', outlineOffset: 3 } : undefined;
    const Tag = block ? 'div' : 'span';
    return onEdit ? <Tag className={cls} style={style} role="button" tabIndex={0} title="Click to edit" onClick={() => onEdit(path)} onKeyDown={(e) => { if (e.key === 'Enter') onEdit(path); }}>{children}</Tag> : <Tag className={cls} style={style}>{children}</Tag>;
  };
  const sec = (t, right) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #FBDCCF', paddingBottom: 4, margin: 'calc(var(--fs) * 1.15) 0 calc(var(--fs) * .6)' }}><span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * .95)', letterSpacing: 1.3, textTransform: 'uppercase', color: '#F06434' }}>{t}</span>{right}</div>;
  const bullets = (sectionKey, i, list) => list.map((b, j) => (
    <div key={j} style={{ display: 'flex', gap: 9, marginBottom: 'calc(var(--fs) * .32)', paddingLeft: 3 }}>
      <span style={{ width: 4.5, height: 4.5, borderRadius: 3, background: '#F06434', marginTop: 'calc(var(--fs) * .6)', flex: 'none' }} />
      <E path={`${sectionKey}.${i}.bullets.${j}.text`}>{b.label ? <b style={{ color: '#1F1D24' }}>{b.label}: </b> : null}<Rich text={b.text} /></E>
    </div>
  ));

  return (
    <div className="paper-wrap" ref={wrap} style={{ height: PAGE_H * scale + (over ? 40 : 0), opacity: dim ? 0.55 : 1 }}>
      <div className="paper" ref={paper} style={{ transform: `scale(${scale})`, '--fs': `${size * PT}px`, fontSize: 'var(--fs)', lineHeight: 1.45, padding: '0 53px 40px', height: 'auto' }}>
        <div style={{ height: 7, margin: '0 -53px 40px', background: 'linear-gradient(90deg,#F06434 0%,#F5A27F 60%,#F9C9B4 100%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #FBDCCF', paddingBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 32, color: '#1F1D24', letterSpacing: -0.4, lineHeight: 1.1 }}>{r.name || 'Your name'}</div>
            <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#F06434', marginTop: 6 }}><E path="title">{r.title}</E></div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 'calc(var(--fs) * .92)', lineHeight: 1.6 }}>
            {r.phone ? <div>{r.phone}</div> : null}
            {r.links.map((l, i) => <div key={i}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#F06434', fontWeight: 600 }}>{l.label}</a></div>)}
            {r.email ? <div>{r.email}</div> : null}
          </div>
        </div>
        {r.summary ? <div style={{ marginTop: 13 }}><E path="summary" block><Rich text={r.summary} /></E></div> : null}
        {r.experience.length ? sec('Professional Experience') : null}
        {r.experience.map((e, i) => (
          <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .9)' : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * 1.02)', color: '#1F1D24' }}>{e.role}{e.company ? `, ${e.company}` : ''}</span>
              <span style={{ fontWeight: 600, fontSize: 'calc(var(--fs) * .9)', color: '#6A6670', whiteSpace: 'nowrap' }}>{e.dates}</span>
            </div>
            {bullets('experience', i, e.bullets)}
          </div>
        ))}
        {r.projects.length ? sec('Projects') : null}
        {r.projects.map((p, i) => (
          <div key={i} style={{ marginTop: i ? 'calc(var(--fs) * .7)' : 0 }}>
            <div style={{ fontFamily: 'Manrope', fontWeight: 800, color: '#1F1D24', marginBottom: 4 }}>{p.name}</div>
            {bullets('projects', i, p.bullets)}
          </div>
        ))}
        {r.education.length ? sec('Education') : null}
        {r.education.map((e, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 'calc(var(--fs) * 1.02)', color: '#1F1D24' }}>{e.school}</span><span style={{ fontWeight: 600, fontSize: 'calc(var(--fs) * .9)', color: '#6A6670' }}>{e.dates}</span></div>
            <div style={{ color: '#6A6670' }}>{e.degree}</div>
          </div>
        ))}
        {r.skills.length ? sec('Skills', r.skillsLink?.url ? <a href={r.skillsLink.url} target="_blank" rel="noreferrer" style={{ fontSize: 'calc(var(--fs) * .85)', fontWeight: 600, color: '#F06434' }}>{r.skillsLink.label || 'Proof of Skills'}</a> : null) : null}
        {r.skills.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 'calc(var(--fs) * .3)' }}>
            <b style={{ width: 144, flex: 'none', color: '#1F1D24' }}>{s.label}</b><E path={`skills.${i}.items`}>{s.items}</E>
          </div>
        ))}
      </div>
      {over ? <div className="pagebreak" style={{ top: PAGE_H * scale }}><span>Page 2 starts here · about {over} lines over</span></div> : null}
    </div>
  );
}
