import { useEffect, useState } from 'react';
import { useStore } from './lib/store.js';
import SignIn, { MoveData } from './screens/Profiles.jsx';
import { useAuth } from './lib/sync.js';
import { legacyProfiles } from './lib/store.js';
import { Logo } from './components/ui.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Jobs from './screens/Jobs.jsx';
import JobDetail from './screens/JobDetail.jsx';
import Resumes from './screens/Resumes.jsx';
import MasterEditor from './screens/MasterEditor.jsx';
import Settings from './screens/Settings.jsx';

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const f = () => { setH(location.hash.slice(1) || '/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export default function App() {
  const route = useHash();
  const active = useStore((s) => s.active);
  const profile = useStore((s) => (s.active ? s.profiles[s.active] : null));
  const [path, query] = route.split('?');
  const params = new URLSearchParams(query || '');

  const auth = useAuth();

  if (auth.status === 'loading' || auth.status === 'syncing' || (auth.status === 'in' && !profile)) return <Splash />;
  if (auth.status === 'out') return <SignIn />;
  if (!profile.setup && !profile.legacyAsked && legacyProfiles().length) return <MoveData pid={active} />;
  if (!profile.setup || path === '/setup') return <Onboarding pid={active} editing={profile.setup} />;
  if (path.startsWith('/job/')) return <JobDetail pid={active} id={decodeURIComponent(path.slice(5))} route={path} />;
  if (path === '/resumes/master') return <MasterEditor pid={active} route={path} />;
  if (path.startsWith('/resumes')) return <Resumes pid={active} route={path} />;
  if (path.startsWith('/settings')) return <Settings pid={active} route={path} />;
  return <Jobs pid={active} route="/jobs" tab={params.get('tab') || 'new'} />;
}

function Splash() {
  return (
    <div className="app" style={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Logo href="#/" />
      <span className="spinner" style={{ width: 28, height: 28, borderWidth: 4 }} role="img" aria-label="Loading" />
    </div>
  );
}
