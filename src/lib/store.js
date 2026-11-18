// App state. Each signed-in Google account has one profile (keyed by its uid).
// It's cached in this browser for speed and synced to Firestore by sync.js.
import { useSyncExternalStore } from 'react';

const KEY = 'shortlist.v2';
const LEGACY_KEY = 'shortlist.v1'; // before sign-in: two local profiles, A and G

export const DEFAULT_PREFS = {
  titles: [], avoid: [], cities: [],
  work: { office: true, hybrid: true, remote: false },
  expHave: '', expMin: '', expMax: '', salMin: '', salMax: '', includeNoSalary: true,
  notice: '', companies: [],
};
export const DEFAULT_LIMITS = { jobsPerDay: 20, tailorPerDay: 10, refinePerDay: 200, refinePerJob: 20 };
export const DEFAULT_MODELS = { tailor: 'gemini-flash-latest', refine: 'gemini-flash-lite-latest', groq: 'openai/gpt-oss-120b' };

export function blankProfile(id, { name = '', role = '', photo = '', email = '' } = {}) {
  return {
    id, name, role, photo, email, setup: false,
    prefs: structuredClone(DEFAULT_PREFS),
    models: { ...DEFAULT_MODELS }, limits: { ...DEFAULT_LIMITS },
    resume: null, resumeFile: '', resumeUpdated: null,
    feed: null,          // { date, fetchedAt, list: [], close: [], notes: [] }
    status: {},          // jobId -> { s: 'applied' | 'skipped', at }
    jobCache: {},        // jobId -> job (kept for Applied / Skipped)
    versions: {},        // jobId -> tailored version
    usage: { date: '', tailor: 0, refine: 0, groq: 0 },
    seen: {},
    notify: true,
  };
}

export function normalizeProfile(id, p) {
  const b = blankProfile(id);
  return { ...b, ...p, id, prefs: { ...DEFAULT_PREFS, ...p?.prefs }, limits: { ...DEFAULT_LIMITS, ...p?.limits }, models: { ...DEFAULT_MODELS, ...p?.models }, status: p?.status || {}, jobCache: p?.jobCache || {}, versions: p?.versions || {} };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data) return { active: null, profiles: {} };
    const profiles = {};
    for (const [id, p] of Object.entries(data.profiles || {})) profiles[id] = normalizeProfile(id, p);
    return { active: data.active && profiles[data.active] ? data.active : null, profiles };
  } catch {
    return { active: null, profiles: {} };
  }
}

// Setups saved on this device before sign-in existed, so they can be moved into an account
export function legacyProfiles() {
  try {
    const data = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    return Object.values(data?.profiles || {}).filter((p) => p && p.setup && p.resume);
  } catch { return []; }
}

let state = load();
const subs = new Set();
let saveError = null;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveError = null;
  } catch (e) {
    saveError = 'Storage is full. Delete a few old tailored versions in Resumes.';
  }
}

export function getState() { return state; }
export function getSaveError() { return saveError; }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }

export function setState(fn) {
  const next = typeof fn === 'function' ? fn(structuredClone(state)) : fn;
  state = next ?? state;
  persist();
  subs.forEach((f) => f());
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function updateProfile(id, fn) {
  setState((s) => { if (s.profiles[id]) fn(s.profiles[id]); return s; });
}

export function setActive(id) {
  setState((s) => { s.active = id; return s; });
}

// Start over, keeping who you are
export function resetProfile(id) {
  setState((s) => { const p = s.profiles[id]; s.profiles[id] = blankProfile(id, { name: p?.name, photo: p?.photo, email: p?.email }); return s; });
}

// Called on sign out: forget this account's cached copy on this device
export function clearLocal() {
  setState({ active: null, profiles: {} });
}

// ---------- dates & usage ----------
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Gemini free quotas reset at midnight Pacific time
export function quotaDay() {
  const pt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return `${pt.getFullYear()}-${pt.getMonth() + 1}-${pt.getDate()}`;
}

export function msUntilQuotaReset() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(pt); next.setHours(24, 0, 0, 0);
  return next - pt;
}

export function usageOf(p) {
  const d = quotaDay();
  return p.usage?.date === d ? p.usage : { date: d, tailor: 0, refine: 0, groq: 0 };
}

export function bumpUsage(id, kind) {
  updateProfile(id, (p) => {
    const u = usageOf(p);
    u[kind] = (u[kind] || 0) + 1;
    p.usage = u;
  });
}

export function formatDuration(ms) {
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function exportProfile(id) {
  const p = state.profiles[id];
  return JSON.stringify({ shortlist: 1, name: p.name, prefs: p.prefs, resume: p.resume }, null, 2);
}
