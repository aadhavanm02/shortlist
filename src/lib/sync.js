// Google sign-in and Firestore sync.
// The UI reads the local store (fast, works offline); this module mirrors the signed-in
// person's profile to Firestore and applies changes made on their other devices.
//
// Firestore layout (each part stored as a JSON string, so any shape is allowed):
//   users/{uid}               { json }  profile minus feed, versions and job cache
//   users/{uid}/parts/feed    { json }  today's job list
//   users/{uid}/versions/{id} { json }  one tailored resume per job
//   users/{uid}/jobs/{id}     { json }  saved job (for Applied and Skipped)
import { useSyncExternalStore } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';
import { API } from './api.js';
import { getState, setState, subscribe, blankProfile, normalizeProfile, clearLocal } from './store.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- auth state for the UI ----------
let authState = { status: 'loading', user: null, error: null }; // loading | out | syncing | in
const authSubs = new Set();
const setAuth = (patch) => { authState = { ...authState, ...patch }; authSubs.forEach((f) => f()); };
export function useAuth() {
  return useSyncExternalStore((cb) => { authSubs.add(cb); return () => authSubs.delete(cb); }, () => authState);
}

export async function signIn() {
  setAuth({ error: null });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return undefined;
    setAuth({ error: friendly(e) });
  }
  return undefined;
}

export async function signOut() {
  await flush();
  stop();
  await fbSignOut(auth);
  clearLocal();
}

function friendly(e) {
  const c = e?.code || '';
  if (c.includes('unauthorized-domain')) return 'This website is not allowed to sign in yet. Add it under Firebase Authentication, Settings, Authorized domains.';
  if (c.includes('operation-not-allowed')) return 'Google sign-in is turned off. Turn it on in Firebase Authentication, Sign-in method.';
  if (c.includes('network')) return 'Could not reach Google. Check your internet and try again.';
  return 'Sign-in did not work. Please try again.';
}

// ---------- splitting a profile into synced parts ----------
function split(p) {
  const { feed, versions, jobCache, ...core } = p;
  const v = {}; for (const [id, x] of Object.entries(versions || {})) v[id] = JSON.stringify(x);
  const j = {}; for (const [id, x] of Object.entries(jobCache || {})) j[id] = JSON.stringify(x);
  return { core: JSON.stringify(core), feed: JSON.stringify(feed ?? null), versions: v, jobs: j };
}

let uid = null;
let last = null;          // the parts as last saved to / read from Firestore
let unsubs = [];
let timer = null;
let pushing = false;
let dirtyAgain = false;
let retryTimer = null;
let currentUser = null;

const userDoc = () => doc(db, 'users', uid);
const feedDoc = () => doc(db, 'users', uid, 'parts', 'feed');
const vDoc = (id) => doc(db, 'users', uid, 'versions', id);
const jDoc = (id) => doc(db, 'users', uid, 'jobs', id);

async function pull() {
  const main = await getDoc(userDoc());
  if (!main.exists()) return null;
  const [feed, vs, js] = await Promise.all([getDoc(feedDoc()), getDocs(collection(db, 'users', uid, 'versions')), getDocs(collection(db, 'users', uid, 'jobs'))]);
  const p = JSON.parse(main.data().json || '{}');
  p.feed = feed.exists() ? JSON.parse(feed.data().json || 'null') : null;
  p.versions = {}; vs.forEach((d) => { p.versions[d.id] = JSON.parse(d.data().json); });
  p.jobCache = {}; js.forEach((d) => { p.jobCache[d.id] = JSON.parse(d.data().json); });
  return p;
}

async function push() {
  if (!uid || !last) return;
  if (pushing) { dirtyAgain = true; return; }
  const p = getState().profiles[uid];
  if (!p) return;
  const cur = split(p);
  const b = writeBatch(db);
  let n = 0;
  if (cur.core !== last.core) { b.set(userDoc(), { json: cur.core, updatedAt: serverTimestamp() }); n++; }
  if (cur.feed !== last.feed) { b.set(feedDoc(), { json: cur.feed }); n++; }
  for (const [id, json] of Object.entries(cur.versions)) if (last.versions[id] !== json) { b.set(vDoc(id), { json }); n++; }
  for (const id of Object.keys(last.versions)) if (!(id in cur.versions)) { b.delete(vDoc(id)); n++; }
  for (const [id, json] of Object.entries(cur.jobs)) if (last.jobs[id] !== json) { b.set(jDoc(id), { json }); n++; }
  for (const id of Object.keys(last.jobs)) if (!(id in cur.jobs)) { b.delete(jDoc(id)); n++; }
  if (!n) return;
  pushing = true;
  try {
    await b.commit();
    last = cur;
    setAuth({ error: null });
  } catch (e) {
    setAuth({ error: e?.code === 'permission-denied' ? 'Your data could not be saved: the database rules need updating in Firebase.' : null });
  } finally {
    pushing = false;
    if (dirtyAgain) { dirtyAgain = false; schedule(); }
  }
}

function schedule() { clearTimeout(timer); timer = setTimeout(push, 1200); }
async function flush() { clearTimeout(timer); await push(); }

// Apply a change made on another device to the local copy
function applyRemote(fn) {
  setState((s) => { const p = s.profiles[uid]; if (p) fn(p); return s; });
}

function listen() {
  unsubs.push(onSnapshot(userDoc(), (snap) => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const json = snap.data().json;
    if (!json || json === last.core) return;
    last = { ...last, core: json };
    const core = JSON.parse(json);
    applyRemote((p) => { Object.keys(p).forEach((k) => { if (!['feed', 'versions', 'jobCache'].includes(k)) delete p[k]; }); Object.assign(p, core); });
  }));
  unsubs.push(onSnapshot(feedDoc(), (snap) => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const json = snap.data().json;
    if (json === last.feed) return;
    last = { ...last, feed: json };
    applyRemote((p) => { p.feed = JSON.parse(json); });
  }));
  const coll = (name, key, field) => onSnapshot(collection(db, 'users', uid, name), (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    const changes = snap.docChanges().filter((c) => (c.type === 'removed' ? key in last && c.doc.id in last[key] : last[key][c.doc.id] !== c.doc.data().json));
    if (!changes.length) return;
    const lk = { ...last[key] };
    changes.forEach((c) => { if (c.type === 'removed') delete lk[c.doc.id]; else lk[c.doc.id] = c.doc.data().json; });
    last = { ...last, [key]: lk };
    applyRemote((p) => { changes.forEach((c) => { if (c.type === 'removed') delete p[field][c.doc.id]; else p[field][c.doc.id] = JSON.parse(c.doc.data().json); }); });
  });
  unsubs.push(coll('versions', 'versions', 'versions'));
  unsubs.push(coll('jobs', 'jobs', 'jobCache'));
  unsubs.push(subscribe(schedule));
  const vis = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', vis);
  unsubs.push(() => document.removeEventListener('visibilitychange', vis));
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = []; uid = null; last = null; clearTimeout(timer);
}

async function start(user) {
  stop();
  currentUser = user;
  clearTimeout(retryTimer);
  uid = user.uid;
  const who = { name: (user.displayName || user.email || 'You').split(' ')[0], photo: user.photoURL || '', email: user.email || '' };
  const cached = getState().profiles[uid];
  setAuth({ status: cached ? 'in' : 'syncing', user });
  try {
    const remote = await pull();
    let profile;
    if (remote) {
      profile = normalizeProfile(uid, { ...remote, ...who });
      last = split(normalizeProfile(uid, remote));
    } else {
      profile = cached ? normalizeProfile(uid, { ...cached, ...who }) : blankProfile(uid, who);
      last = { core: '', feed: '', versions: {}, jobs: {} }; // nothing in the cloud yet: save everything
    }
    setState((s) => { s.profiles = { [uid]: profile }; s.active = uid; return s; });
    listen();
    schedule();
    setAuth({ status: 'in', error: null });
  } catch (e) {
    // offline or rules not set: keep working from this device's copy
    if (!cached) setState((s) => { s.profiles = { [uid]: blankProfile(uid, who) }; s.active = uid; return s; });
    last = null;
    setAuth({ status: 'in', error: e?.code === 'permission-denied' ? 'Sync is paused: the database is not allowing access yet. Retrying…' : 'Working offline. Changes will sync when you are back online.' });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (currentUser && !last) start(currentUser); }, 20000);
  }
}

// Try again as soon as the app comes back to the front or the network returns
if (typeof window !== 'undefined') {
  const again = () => { if (currentUser && !last && document.visibilityState === 'visible') start(currentUser); };
  document.addEventListener('visibilitychange', again);
  window.addEventListener('online', again);
}

onAuthStateChanged(auth, (user) => {
  if (user) start(user);
  else { currentUser = null; clearTimeout(retryTimer); stop(); setAuth({ status: 'out', user: null }); }
});

// This person's master resume (and suggested preferences), kept privately on the server
export async function fetchMaster() {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    const res = await fetch(`${API}/master`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data : null;
  } catch { return null; }
}
