// AI calls go straight from the browser to the provider with the user's own free key.
import { getState, usageOf, bumpUsage } from './store.js';
import { lines, validPath, getPath, stripDashes } from './resume.js';

export class AIError extends Error {
  constructor(kind, msg) { super(msg); this.kind = kind; } // kind: nokey | quota | network | bad | server
}

async function gemini(key, model, system, user, timeoutMs = 60000) {
  if (!key) throw new AIError('nokey', 'Add your free Gemini key in Settings.');
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.35 },
      }),
    });
  } catch (e) {
    throw new AIError('network', e.name === 'AbortError' ? 'Gemini took too long to respond.' : 'Could not reach Gemini. Check your internet.');
  } finally { clearTimeout(t); }
  if (res.status === 429) throw new AIError('quota', 'Gemini says the free limit for this model is used up.');
  if (res.status === 400 || res.status === 403) {
    const body = await res.text();
    if (/API key|API_KEY|permission/i.test(body)) throw new AIError('nokey', 'Gemini rejected the key. Check it in Settings.');
    if (/not found|model/i.test(body)) throw new AIError('bad', `Model "${model}" isn't available. Change it in Settings.`);
    throw new AIError('server', 'Gemini could not process this request.');
  }
  if (!res.ok) throw new AIError('server', `Gemini error ${res.status}. Try again.`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return parseJSON(text);
}

async function groq(key, model, system, user) {
  if (!key) throw new AIError('nokey', 'Add a free Groq key in Settings to use the backup AI.');
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.35, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
  } catch { throw new AIError('network', 'Could not reach Groq. Check your internet.'); }
  if (res.status === 429) throw new AIError('quota', 'Groq says the free limit is used up for now.');
  if (res.status === 401) throw new AIError('nokey', 'Groq rejected the key. Check it in Settings.');
  if (!res.ok) throw new AIError('server', `Groq error ${res.status}. Try again.`);
  const data = await res.json();
  return parseJSON(data?.choices?.[0]?.message?.content || '');
}

function parseJSON(text) {
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(clean); } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
    throw new AIError('bad', 'The AI sent back something unreadable. Try again.');
  }
}

// engine: 'tailor' (Gemini Flash), 'refine' (Flash-Lite), 'groq'
export async function callAI(profileId, engine, system, user) {
  const p = getState().profiles[profileId];
  const u = usageOf(p);
  if (engine === 'groq') {
    const out = await groq(p.keys.groq, p.models.groq, system, user);
    bumpUsage(profileId, 'groq'); return out;
  }
  if (engine === 'tailor' && u.tailor >= p.limits.tailorPerDay) throw new AIError('quota', 'All of today\'s tailorings are used.');
  if (engine === 'refine' && u.refine >= p.limits.refinePerDay) throw new AIError('quota', 'All of today\'s refinements are used.');
  const model = engine === 'tailor' ? p.models.tailor : p.models.refine;
  const out = await gemini(p.keys.gemini, model, system, user);
  bumpUsage(profileId, engine === 'tailor' ? 'tailor' : 'refine');
  return out;
}

const RULES = `Hard rules:
- Never invent experience, employers, titles, dates, metrics, tools, domains or responsibilities. Only reword, reorder or emphasise what is already in the resume.
- If the job asks for something the resume does not show, do not add it. List it under "questions" so the person can confirm.
- Use plain, clear words a recruiter understands. Mirror the job's exact wording only where it truthfully fits (helps ATS).
- Keep the resume to one A4 page: replacements should be the same length or shorter than the original unless a line is clearly too thin.
- Keep **double asterisks** around numbers/metrics that already have them, and you may bold key metrics.
- Never use em dashes. Use commas or full stops.`;

export function tailorPrompt(resume, job) {
  const L = lines(resume).map(([p, t]) => `[${p}] ${t}`).join('\n');
  const system = `You are an expert resume editor and ATS specialist. You tailor a candidate's existing resume to one job description.
${RULES}
Return JSON only:
{
 "atsBefore": number 0-100, "atsAfter": number 0-100,
 "have": [up to 10 short keywords from the job already shown in the resume],
 "missing": [up to 6 short keywords the job asks for that the resume does not show],
 "suggestions": [ { "path": "<exact path from the list>", "after": "<full replacement text for that line>", "why": "<one short sentence>" } ],
 "questions": [ { "skill": "<thing>", "question": "<ask if they have it>", "addTo": "<path of a skills line to append it to, or empty>" } ]
}
Give 3 to 8 suggestions, most valuable first. For skills lines, "after" is the full items list without the label. For bullets, "after" is the text without the "Label:" prefix.`;
  const user = `JOB: ${job.title} at ${job.company}\n\nJOB DESCRIPTION:\n${(job.description || '').slice(0, 9000)}\n\nRESUME LINES (path in brackets):\n${L}`;
  return { system, user };
}

export function cleanTailor(resume, out) {
  const sugg = (out.suggestions || []).filter((s) => validPath(resume, s.path) && s.after && s.after.trim() !== String(getPath(resume, s.path)).trim())
    .slice(0, 10).map((s, i) => ({ id: `s${i}`, path: s.path, before: getPath(resume, s.path), after: stripDashes(dropLabel(resume, s.path, s.after)), why: s.why || '', state: 'open' }));
  const qs = (out.questions || []).filter((q) => q.skill).slice(0, 4).map((q, i) => ({ id: `q${i}`, skill: q.skill, question: q.question || `The job asks for ${q.skill}. Have you used it?`, addTo: validPath(resume, q.addTo || '') ? q.addTo : (resume.skills.length ? `skills.${resume.skills.length - 1}.items` : ''), state: 'open' }));
  return { suggestions: sugg, questions: qs, atsBefore: clamp(out.atsBefore), atsAfter: clamp(out.atsAfter), have: (out.have || []).slice(0, 10), missing: (out.missing || []).slice(0, 6) };
}
// The AI sometimes repeats "Label: " at the start of a bullet or skills line; strip it
export function dropLabel(resume, path, text) {
  const k = path.split('.');
  let label = '';
  if (k[0] === 'skills') label = resume.skills[+k[1]]?.label || '';
  else if (k[2] === 'bullets') label = resume[k[0]]?.[+k[1]]?.bullets?.[+k[3]]?.label || '';
  const t = (text || '').trim();
  if (label && t.toLowerCase().startsWith(label.toLowerCase() + ':')) return t.slice(label.length + 1).trim();
  return t;
}
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export function refinePrompt(resume, job, history, message) {
  const L = lines(resume).map(([p, t]) => `[${p}] ${t}`).join('\n');
  const system = `You are an expert resume editor. The person asks for changes to their tailored resume in one message, often several at once. Apply every request you can.
${RULES}
If a request would break a rule (for example adding experience they don't have), don't apply it: say so briefly and offer the closest truthful alternative.
Moving a bullet up or down: return "moves". Changing text: return "changes".
Return JSON only:
{ "reply": "<short friendly summary of what you changed and anything you refused, 1 to 4 sentences>",
  "changes": [ { "path": "<exact path>", "after": "<full new text>" } ],
  "moves": [ { "section": "experience" | "projects", "index": <entry index>, "from": <bullet index>, "to": <bullet index> } ] }`;
  const hist = history.slice(-6).map((m) => `${m.role === 'me' ? 'Person' : 'You'}: ${m.text}`).join('\n');
  const user = `JOB: ${job.title} at ${job.company}\nJOB DESCRIPTION (excerpt):\n${(job.description || '').slice(0, 5000)}\n\nCURRENT RESUME LINES:\n${L}\n\nEARLIER IN THIS CHAT:\n${hist || '(none)'}\n\nNEW MESSAGE:\n${message}`;
  return { system, user };
}

export function importPrompt(text, links) {
  const system = `You convert raw text extracted from a resume PDF into structured JSON. Copy the person's wording exactly; fix only broken line wraps and stray characters. Do not invent anything. If something is missing, leave it empty.
Bullets: if a bullet starts with a short bold-like label followed by a colon, put that in "label", else label is "".
Return JSON only, in this shape:
{"name":"","title":"","phone":"","email":"","links":[{"label":"","url":""}],"summary":"",
 "experience":[{"role":"","company":"","dates":"","bullets":[{"label":"","text":""}]}],
 "projects":[{"name":"","bullets":[{"label":"","text":""}]}],
 "education":[{"school":"","degree":"","dates":""}],
 "skills":[{"label":"","items":"comma separated"}],
 "incomplete":[ "<short notes about anything that looks cut off or unreadable>" ]}`;
  const user = `LINKS FOUND IN THE PDF: ${links.join(', ') || 'none'}\n\nRESUME TEXT:\n${text.slice(0, 12000)}`;
  return { system, user };
}

export function trimPrompt(resume, overBy) {
  const L = lines(resume).map(([p, t]) => `[${p}] ${t}`).join('\n');
  const system = `You shorten a resume so it fits one A4 page. ${RULES}
Return JSON only: { "trims": [ { "title": "<short name of the trim>", "detail": "<what it removes, one sentence>", "changes": [ { "path": "", "after": "" } ] } ] } with 2 or 3 options, each saving roughly ${overBy} lines or more. Never remove metrics.`;
  return { system, user: `RESUME LINES:\n${L}` };
}
