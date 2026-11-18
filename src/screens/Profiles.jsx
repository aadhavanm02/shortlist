import { useState } from 'react';
import { Logo, Banner, Avatar } from '../components/ui.jsx';
import { useAppVersion, useInstall } from '../lib/pwa.js';
import { signIn, useAuth } from '../lib/sync.js';
import { updateProfile, legacyProfiles } from '../lib/store.js';

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" /></svg>
);

// Sign in with Google. Replaces the old two-profile picker.
export default function SignIn() {
  const auth = useAuth();
  const version = useAppVersion();
  const inst = useInstall();
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); await signIn(); setBusy(false); };
  return (
    <div className="app" style={{ minHeight: '100dvh' }}>
      <header style={{ padding: '20px 20px 0' }}><Logo href="../" /></header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="col" style={{ width: '100%', maxWidth: 420, gap: 22 }}>
          <div className="col" style={{ gap: 8 }}>
            <h1 style={{ fontSize: 32, lineHeight: 1.12 }}>Your job hunt, on every device</h1>
            <p className="sub">Sign in with Google and your jobs, resumes and progress follow you from phone to laptop.</p>
          </div>
          {auth.error ? <Banner tone="err">{auth.error}</Banner> : null}
          <button className="btn lg full" style={{ background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--border)' }} onClick={go} disabled={busy}>
            <GoogleG />{busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <p className="small" style={{ margin: 0 }}>We only use your name, email and photo. Your data is private to your account.</p>
        </div>
      </main>
      <footer style={{ padding: '0 20px calc(22px + env(safe-area-inset-bottom))', textAlign: 'center' }} className="small">
        {version} · <a href="../changelog.html">What's new</a>{inst.installed ? null : <> · <a href="../install.html">Install app</a></>}
      </footer>
    </div>
  );
}

// After a first sign-in on a device that has an older local setup: offer to move it in
export function MoveData({ pid }) {
  const old = legacyProfiles();
  const use = (lp) => updateProfile(pid, (p) => {
    for (const k of ['prefs', 'resume', 'resumeFile', 'resumeUpdated', 'feed', 'status', 'jobCache', 'versions', 'usage', 'seen', 'limits', 'models', 'role']) if (lp[k] !== undefined) p[k] = lp[k];
    p.setup = true; p.legacyAsked = true;
  });
  const skip = () => updateProfile(pid, (p) => { p.legacyAsked = true; });
  return (
    <div className="app" style={{ minHeight: '100dvh' }}>
      <header style={{ padding: '20px 20px 0' }}><Logo href="#/" /></header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="col" style={{ width: '100%', maxWidth: 460, gap: 20 }}>
          <div className="col" style={{ gap: 8 }}><h1 style={{ fontSize: 28, lineHeight: 1.15 }}>Use your existing setup?</h1><p className="sub">We found a setup saved on this device. Move it into your account so it's on all your devices.</p></div>
          <div className="mlist">
            {old.map((lp) => (
              <button key={lp.id} className="mrow" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', gap: 12 }} onClick={() => use(lp)}>
                <Avatar name={lp.name} s={44} />
                <span className="mrow-main"><span className="mrow-t">{lp.name}'s setup</span><span className="mrow-s">{lp.role}{Object.keys(lp.versions || {}).length ? ` · ${Object.keys(lp.versions).length} tailored resumes` : ''}</span></span>
                <span className="btn sm" style={{ marginRight: 8 }}>Use</span>
              </button>
            ))}
          </div>
          <button className="btn ghost" onClick={skip}>Start fresh instead</button>
        </div>
      </main>
    </div>
  );
}
