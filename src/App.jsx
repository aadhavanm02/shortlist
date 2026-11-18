import { useEffect, useState } from 'react';
import { useStore } from './lib/store.js';
import Profiles from './screens/Profiles.jsx';
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

  if (!active || path === '/') return <Profiles />;
  if (!profile.setup || path === '/setup') return <Onboarding pid={active} editing={profile.setup} />;
  if (path.startsWith('/job/')) return <JobDetail pid={active} id={decodeURIComponent(path.slice(5))} route={path} />;
  if (path === '/resumes/master') return <MasterEditor pid={active} route={path} />;
  if (path.startsWith('/resumes')) return <Resumes pid={active} route={path} />;
  if (path.startsWith('/settings')) return <Settings pid={active} route={path} />;
  return <Jobs pid={active} route="/jobs" tab={params.get('tab') || 'new'} />;
}
