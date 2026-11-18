// Android (Capacitor) helpers. On the web these fall back to normal browser behaviour.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Android WebViews ignore <a download>, so save the file and open the share sheet
// (Save to Files, Drive, WhatsApp, Gmail...). Saves to Documents/Shortlist when allowed.
export async function saveNative(blob, name) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const safe = name.replace(/[\\/:*?"<>|]+/g, '-');
  const data = await toBase64(blob);
  let uri;
  try {
    uri = (await Filesystem.writeFile({ path: `Shortlist/${safe}`, data, directory: Directory.Documents, recursive: true })).uri;
  } catch {
    uri = (await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache, recursive: true })).uri;
  }
  try { await Share.share({ title: safe, files: [uri], dialogTitle: 'Save or send your file' }); } catch { /* share sheet closed */ }
  return uri;
}

// Daily 7 AM reminder that today's jobs are ready (Android only)
export async function scheduleMorningReminder(on = true) {
  if (!isNative) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const ID = 7001;
  await LocalNotifications.cancel({ notifications: [{ id: ID }] }).catch(() => {});
  if (!on) return;
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;
  await LocalNotifications.schedule({
    notifications: [{
      id: ID,
      title: 'Your jobs for today are ready',
      body: 'Open Shortlist to see today\'s best matches.',
      schedule: { on: { hour: 7, minute: 0 }, allowWhileIdle: true },
      smallIcon: 'ic_stat_shortlist',
      iconColor: '#F06434',
    }],
  });
}

// Android back button: close an open sheet or the chat first (they listen for 'appback'),
// then go back a screen, and leave the app from the Jobs screen.
async function setupBackButton() {
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    const ev = new Event('appback', { cancelable: true });
    if (!window.dispatchEvent(ev)) return;
    const h = location.hash.replace(/^#/, '').split('?')[0] || '/';
    if (h === '/jobs' || h === '/') { App.exitApp(); return; }
    if (canGoBack && history.length > 1) history.back();
    else location.hash = '#/jobs';
  });
}

export async function setupNative() {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  try { await setupBackButton(); } catch { /* optional */ }
  try { await scheduleMorningReminder(true); } catch { /* notifications are optional */ }
}
