import { useStore, setActive } from '../lib/store.js';
import { Logo, Avatar, Icon, useMobile } from '../components/ui.jsx';
import { useAppVersion } from '../lib/native.js';

export default function Profiles() {
  const profiles = useStore((s) => s.profiles);
  const version = useAppVersion();
  const mobile = useMobile();
  if (mobile) return (
    <div className="app" style={{ minHeight: '100dvh' }}>
      <header style={{ padding: '20px 20px 0' }}><Logo /></header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26, padding: 20 }}>
        <div className="col" style={{ gap: 8 }}><h1 style={{ fontSize: 30, lineHeight: 1.15 }}>Who's job hunting today?</h1><p className="sub">Pick your profile. We'll remember it.</p></div>
        <div className="col" style={{ gap: 14 }}>
          {['A', 'G'].map((id) => {
            const p = profiles[id];
            const n = p.feed?.list?.filter((j) => !p.status[j.id]).length;
            return (
              <button key={id} onClick={() => open(id)} className="row" style={{ background: '#fff', border: '1.5px solid var(--line)', borderRadius: 16, padding: 18, gap: 14, flexWrap: 'nowrap', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <Avatar id={id} s={54} />
                <span className="col" style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--h)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{p.name}</span>
                  <span style={{ fontSize: 14, color: 'var(--mut)' }}>{p.role}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: p.setup ? '#1F7A4D' : 'var(--acct)' }}>{p.setup ? (n != null ? `${n} new jobs today` : 'Ready') : 'Not set up yet · Start setup'}</span>
                </span>
                <Icon n="chev" c="var(--mut)" />
              </button>
            );
          })}
        </div>
      </main>
      <footer style={{ padding: '0 20px calc(22px + env(safe-area-inset-bottom))', textAlign: 'center' }} className="small">Switch profiles anytime from Settings.<br />{version} · <a href="../changelog.html" target="_blank" rel="noreferrer">What's new</a></footer>
    </div>
  );
  const open = (id) => { setActive(id); location.hash = profiles[id].setup ? '#/jobs' : '#/setup'; };
  return (
    <div className="app">
      <header style={{ padding: '18px 32px' }}><Logo /></header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '32px 16px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>Who's job hunting today?</h1>
          <p className="sub" style={{ fontSize: 16 }}>Pick your profile. Your preferences and resume are saved on this device.</p>
        </div>
        <div className="grid2" style={{ width: '100%', maxWidth: 720, gap: 20 }}>
          {['A', 'G'].map((id) => {
            const p = profiles[id];
            const n = p.feed?.list?.filter((j) => !p.status[j.id]).length;
            return (
              <button key={id} onClick={() => open(id)} className="card" style={{ cursor: 'pointer', textAlign: 'left', border: '1.5px solid var(--line)', padding: 28, gap: 18 }}>
                <Avatar id={id} s={64} />
                <div className="col" style={{ gap: 4 }}><span style={{ fontFamily: 'var(--h)', fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>{p.name}</span><span className="sub">{p.role}</span></div>
                <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: p.setup ? '#1F7A4D' : 'var(--acct)' }}>{p.setup ? (n != null ? `${n} jobs waiting` : 'Ready') : 'Not set up yet · Start setup'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--acct)' }}>Open<Icon n="chev" s={16} /></span>
                </div>
              </button>
            );
          })}
        </div>
      </main>
      <footer style={{ padding: 20, textAlign: 'center' }} className="small">Two profiles only. Switch anytime from Settings.<br />{version} · <a href="../changelog.html" target="_blank" rel="noreferrer">What's new</a></footer>
    </div>
  );
}
