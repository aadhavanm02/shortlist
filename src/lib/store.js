// Local-only storage: everything lives in this browser, nothing is sent to a server.
import { useSyncExternalStore } from 'react';

const KEY = 'shortlist.v1';

export const DEFAULT_PREFS = {
  titles: [], avoid: [], cities: [],
  work: { office: true, hybrid: true, remote: false },
  expHave: '', expMin: '', expMax: '', salMin: '', salMax: '', includeNoSalary: true,
  notice: '', companies: [],
};
export const DEFAULT_LIMITS = { jobsPerDay: 20, tailorPerDay: 20, refinePerDay: 400, refinePerJob: 20 };
export const DEFAULT_MODELS = { tailor: 'gemini-flash-latest', refine: 'gemini-flash-lite-latest', groq: 'openai/gpt-oss-120b' };

function blankProfile(id, name, role) {
  return {
    id, name, role, setup: false,
    prefs: structuredClone(DEFAULT_PREFS),
    keys: { gemini: '', groq: '', rapidapi: '', adzunaId: '', adzunaKey: '' },
    models: { ...DEFAULT_MODELS }, limits: { ...DEFAULT_LIMITS },
    resume: null, resumeFile: '', resumeUpdated: null,
    feed: null,          // { date, fetchedAt, list: [], close: [], notes: [] }
    status: {},          // jobId -> { s: 'applied' | 'skipped', at }
    jobCache: {},        // jobId -> job (kept for Applied / Skipped)
    versions: {},        // jobId -> tailored version
    usage: { date: '', tailor: 0, refine: 0, groq: 0 },
    notify: true,
  };
}

function initial() {
  return {
    active: null,
    profiles: {
      A: blankProfile('A', 'Aadhavan', 'Product Designer'),
      G: blankProfile('G', 'Gayathri', 'Business Analyst'),
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const data = JSON.parse(raw);
    const base = initial();
    for (const id of ['A', 'G']) {
      const p = data.profiles?.[id];
      if (p) base.profiles[id] = { ...base.profiles[id], ...p, prefs: { ...DEFAULT_PREFS, ...p.prefs }, limits: { ...DEFAULT_LIMITS, ...p.limits }, models: { ...DEFAULT_MODELS, ...p.models } };
    }
    base.active = data.active ?? null;
    return base;
  } catch {
    return initial();
  }
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

export function setState(fn) {
  const next = typeof fn === 'function' ? fn(structuredClone(state)) : fn;
  state = next ?? state;
  persist();
  subs.forEach((f) => f());
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => selector(state));
}

export function updateProfile(id, fn) {
  setState((s) => { fn(s.profiles[id]); return s; });
}

export function setActive(id) {
  setState((s) => { s.active = id; return s; });
}

export function resetProfile(id) {
  const fresh = initial().profiles[id];
  setState((s) => { s.profiles[id] = fresh; if (s.active === id) s.active = null; return s; });
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
