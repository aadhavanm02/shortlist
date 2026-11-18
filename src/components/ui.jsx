import { useEffect, useRef, useState } from 'react';
import { useStore, usageOf, setActive } from '../lib/store.js';
import { isNative } from '../lib/native.js';

const P = {
  back: <path d="M15 6l-6 6 6 6" />, search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  check: <path d="M5 12l4 4L19 6" />, alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>,
  wifi: <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.6M19 12.5a10 10 0 0 0-2.2-1.6M12 20h.01" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  plus: <path d="M12 5v14M5 12h14" />, x: <path d="M6 6l12 12M18 6L6 18" />, chev: <path d="M9 6l6 6-6 6" />, down: <path d="M6 9l6 6 6-6" />,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  wand: <path d="M4 20l10-10M14 4l1.5 3L19 8.5 15.5 10 14 13l-1.5-3L9 8.5 12.5 7z" />, chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  send: <path d="M5 12h14M13 6l6 6-6 6" />, mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />, pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>, upload: <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
};

// Android layout: the native app, or any phone-width screen
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)') : null;
export function useMobile() {
  const [m, setM] = useState(isNative || !!mq?.matches);
  useEffect(() => { if (isNative || !mq) return undefined; const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  return m;
}

// Android top app bar: back arrow, title + subtitle, trailing actions
export function AppBar({ back, onBack, title, sub, children }) {
  return (
    <header className="appbar">
      {back || onBack ? (onBack
        ? <button className="iconbtn" aria-label="Back" onClick={onBack}><Icon n="back" s={22} /></button>
        : <a className="iconbtn" aria-label="Back" href={back}><Icon n="back" s={22} /></a>) : null}
      <div className="appbar-t"><span className="t">{title}</span>{sub ? <span className="s">{sub}</span> : null}</div>
      {children}
    </header>
  );
}

// Android bottom navigation for the three top-level screens
export function BottomNav({ route }) {
  const item = (href, r, icon, label) => {
    const on = route.startsWith(r);
    return <a href={href} className={`bnav-i ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}><span className="bnav-ic"><Icon n={icon} s={22} /></span>{label}</a>;
  };
  return <nav className="bnav" aria-label="Main">{item('#/jobs', '/jobs', 'briefcase', 'Jobs')}{item('#/resumes', '/resumes', 'file', 'Resumes')}{item('#/settings', '/settings', 'gear', 'Settings')}</nav>;
}
export function Icon({ n, s = 20, w = 2, c = 'currentColor' }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>;
}

export function Logo({ href = '#/' }) {
  return <a className="logo" href={href}><span className="logo-mark"><Icon n="check" s={16} w={2.4} c="#fff" /></span><span className="logo-text">Shortlist</span></a>;
}

export function Avatar({ id, s = 32 }) {
  const a = id === 'A';
  return <span style={{ width: s, height: s, flex: 'none', borderRadius: '50%', background: a ? 'var(--tint)' : 'var(--bluebg)', color: a ? 'var(--acct)' : '#3A4FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--h)', fontWeight: 800, fontSize: s * 0.45 }}>{a ? 'A' : 'G'}</span>;
}

export function Quota({ pid }) {
  const p = useStore((s) => s.profiles[pid]);
  const u = usageOf(p); const left = Math.max(0, p.limits.tailorPerDay - u.tailor);
  return <span className="quota" title="AI tailorings left today"><span className={`dot ${left === 0 ? 'out' : left <= 3 ? 'low' : ''}`} />Tailorings left today: {left} of {p.limits.tailorPerDay}</span>;
}

export function TopBar({ pid, route, back, title, sub }) {
  const p = useStore((s) => s.profiles[pid]);
  const mobile = useMobile();
  if (mobile) {
    if (back) return <AppBar back={back.href} title={title || back.label} sub={sub} />;
    return (
      <>
        {title ? (
          <header className="mhead" style={{ paddingBottom: 14 }}>
            <div className="between" style={{ flexWrap: 'nowrap' }}>
              <div className="col" style={{ gap: 2, minWidth: 0 }}><h1>{title}</h1>{sub ? <span className="small">{sub}</span> : null}</div>
              <button className="avatar-btn" aria-label="Switch profile" onClick={() => { setActive(null); location.hash = '#/'; }}><Avatar id={pid} s={40} /></button>
            </div>
          </header>
        ) : null}
        <BottomNav route={route} />
      </>
    );
  }
  const on = (r) => (route.startsWith(r) ? 'navlink on' : 'navlink');
  return (
    <header className="topbar">
      <div className="left">
        <Logo href="#/jobs" />
        {back ? <a href={back.href} className="navlink" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--acct)' }}><Icon n="back" s={16} />{back.label}</a> : null}
      </div>
      <nav>
        <a className={on('/jobs')} href="#/jobs">Jobs</a>
        <a className={on('/resumes')} href="#/resumes">Resumes</a>
        <a className={on('/settings')} href="#/settings">Settings</a>
        <span className="divider-v hide-sm" />
        <span className="hide-sm"><Quota pid={pid} /></span>
        <button className="btn secondary sm" style={{ borderRadius: 999, paddingLeft: 6 }} onClick={() => { setActive(null); location.hash = '#/'; }} aria-label="Switch profile">
          <Avatar id={pid} />{p.name}<Icon n="down" s={14} />
        </button>
      </nav>
    </header>
  );
}

export function Banner({ tone = 'warn', icon = 'alert', children, action }) {
  return <div className={`banner ${tone}`} role={tone === 'err' ? 'alert' : 'status'}><Icon n={icon} /><span>{children}</span>{action}</div>;
}

export function Empty({ icon = 'search', tone = '', title, children, actions }) {
  return <div className="empty"><div className={`ic ${tone}`}><Icon n={icon} s={34} /></div><h2 style={{ fontSize: 24 }}>{title}</h2><p>{children}</p>{actions ? <div className="row" style={{ justifyContent: 'center' }}>{actions}</div> : null}</div>;
}

export function Modal({ children, onClose, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('button, a, input, textarea')?.focus();
    const k = (e) => { if (e.key === 'Escape') onClose?.(); };
    const b = (e) => { e.preventDefault(); onClose?.(); };
    document.addEventListener('keydown', k); addEventListener('appback', b);
    return () => { document.removeEventListener('keydown', k); removeEventListener('appback', b); prev?.focus?.(); };
  }, [onClose]);
  return <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>{children}</div></div>;
}

export function useToast() {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const show = (text, action, onAction) => { clearTimeout(timer.current); setT({ text, action, onAction }); timer.current = setTimeout(() => setT(null), 6000); };
  const node = t ? <div className="toast" role="status">{t.text}{t.action ? <button onClick={() => { t.onAction?.(); setT(null); }}>{t.action}</button> : null}</div> : null;
  return [node, show];
}

export function Field({ label, hint, error, children }) {
  return <label className="field">{label}{children}{error ? <span className="error"><Icon n="alert" s={16} />{error}</span> : hint ? <span className="hint">{hint}</span> : null}</label>;
}

export function TagInput({ label, value, onChange, suggestions = [], placeholder, error, hint }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hl, setHl] = useState(0);
  const opts = q ? suggestions.filter((s) => s.toLowerCase().includes(q.toLowerCase()) && !value.includes(s)).slice(0, 5) : [];
  const add = (v) => { const t = v.trim(); if (t && !value.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]); setQ(''); setHl(0); };
  const id = 'tag-' + label.replace(/\W+/g, '');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`tagbox ${error ? 'bad' : ''}`}>
        {value.map((v) => <span className="tag" key={v}>{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><Icon n="x" s={13} w={2.6} /></button></span>)}
        <input id={id} value={q} placeholder={value.length ? '' : placeholder} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(opts[hl] && e.key === 'Enter' && hl < opts.length ? opts[hl] : q); }
            else if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
            else if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, opts.length));
            else if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0));
          }} />
        {open && q ? (
          <div className="suggest" role="listbox">
            {opts.map((o, i) => <button type="button" key={o} className={i === hl ? 'hl' : ''} onMouseDown={() => add(o)}>{o}</button>)}
            <button type="button" className={hl === opts.length ? 'hl' : ''} style={{ color: 'var(--acct)', fontWeight: 600 }} onMouseDown={() => add(q)}>+ Add “{q}” as a keyword</button>
          </div>
        ) : null}
      </div>
      {error ? <span className="error"><Icon n="alert" s={16} />{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Toggle({ on, onClick, children }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{on ? <Icon n="check" s={14} w={2.6} /> : null}{children}</button>;
}

export function Score({ n, big }) {
  return <span className={`score ${n >= 85 ? 'hi' : ''}`} style={big ? {} : { fontSize: 13, padding: '3px 10px' }}>{n}%{big ? ' match' : ''}</span>;
}

export function Skeleton() {
  return <div className="skel" aria-hidden="true"><i style={{ width: '60%', height: 14 }} /><i style={{ width: '42%' }} /><i style={{ width: '28%', height: 10 }} /></div>;
}
