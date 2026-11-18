// All provider calls go through the Shortlist Worker (worker/), which holds the API keys.
// Override with VITE_API_BASE for local testing against `wrangler dev`.
import { useEffect, useState } from 'react';

export const API = (import.meta.env.VITE_API_BASE || 'https://shortlist-api.aadhavanm8.workers.dev').replace(/\/$/, '');

// Which providers the Worker has keys for: { gemini, groq, jsearch, adzuna }
let statusPromise = null;
export function getStatus() {
  if (!statusPromise) {
    statusPromise = fetch(`${API}/status`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch((e) => { statusPromise = null; throw e; });
  }
  return statusPromise;
}

export function useStatus() {
  const [s, setS] = useState(null);
  useEffect(() => { let live = true; getStatus().then((v) => live && setS(v)).catch(() => {}); return () => { live = false; }; }, []);
  return s;
}
