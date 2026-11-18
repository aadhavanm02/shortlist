// Installable web app helpers: Chrome's install prompt and the version label.
import { useEffect, useState } from 'react';

export const APP_VERSION = '2.0';

// Chrome fires this once when the app can be installed; keep it for our own button
let deferred = null;
const subs = new Set();
const notify = () => subs.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// { installed, canPrompt, ios, install() }
export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIOS(),
    install: async () => { if (!deferred) return false; deferred.prompt(); const { outcome } = await deferred.userChoice; deferred = null; notify(); return outcome === 'accepted'; },
  };
}

export function useAppVersion() {
  const date = new Date(__BUILD_DATE__).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Version ${APP_VERSION} · updated ${date}`;
}
