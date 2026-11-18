import { useStore, setActive } from '../lib/store.js';
import { Logo, Avatar, Icon } from '../components/ui.jsx';

export default function Profiles() {
  const profiles = useStore((s) => s.profiles);
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
      <footer style={{ padding: 20, textAlign: 'center' }} className="small">Two profiles only. Switch anytime from the top bar.</footer>
    </div>
  );
}
