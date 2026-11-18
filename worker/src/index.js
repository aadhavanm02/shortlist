// Shortlist API: a tiny Cloudflare Worker that keeps the API keys secret.
// The web app calls this Worker; the Worker adds the key and forwards to the provider.
// Keys are Worker secrets (wrangler secret put ...), never in the repo or the app bundle.

const ALLOWED = [
  'https://aadhavanm02.github.io',
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function allowedOrigin(origin) {
  return !!origin && ALLOWED.some((a) => (typeof a === 'string' ? a === origin : a.test(origin)));
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

// Pass the provider's response through, with our CORS headers
async function relay(res, origin) {
  const h = new Headers({ 'Content-Type': res.headers.get('Content-Type') || 'application/json', ...cors(origin) });
  return new Response(res.body, { status: res.status, headers: h });
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (!allowedOrigin(origin)) return new Response('Forbidden', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    const url = new URL(req.url);
    const path = url.pathname;

    // Which providers have a key set (no key values are ever returned)
    if (path === '/status') {
      return json({ gemini: !!env.GEMINI_KEY, groq: !!env.GROQ_KEY, jsearch: !!env.RAPIDAPI_KEY, adzuna: !!(env.ADZUNA_ID && env.ADZUNA_KEY) }, 200, origin);
    }

    // POST /gemini/<model>  body = Gemini generateContent body
    const gm = path.match(/^\/gemini\/([\w.-]+)$/);
    if (gm && req.method === 'POST') {
      if (!env.GEMINI_KEY) return json({ error: 'nokey' }, 503, origin);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gm[1]}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body: req.body,
      });
      return relay(res, origin);
    }

    // POST /groq  body = OpenAI-style chat completions body
    if (path === '/groq' && req.method === 'POST') {
      if (!env.GROQ_KEY) return json({ error: 'nokey' }, 503, origin);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_KEY}` }, body: req.body,
      });
      return relay(res, origin);
    }

    // GET /jsearch?<JSearch search-v2 query params>
    if (path === '/jsearch' && req.method === 'GET') {
      if (!env.RAPIDAPI_KEY) return json({ error: 'nokey' }, 503, origin);
      const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2${url.search}`, {
        headers: { 'X-RapidAPI-Key': env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      });
      return relay(res, origin);
    }

    // GET /adzuna?<Adzuna search params, without app_id/app_key>
    if (path === '/adzuna' && req.method === 'GET') {
      if (!env.ADZUNA_ID || !env.ADZUNA_KEY) return json({ error: 'nokey' }, 503, origin);
      const q = new URLSearchParams(url.search);
      q.set('app_id', env.ADZUNA_ID); q.set('app_key', env.ADZUNA_KEY);
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/1?${q}`);
      return relay(res, origin);
    }

    return json({ error: 'not found' }, 404, origin);
  },
};
