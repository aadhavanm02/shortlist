// Read a resume PDF into the app's resume format (uses 1 AI refinement).
import { readPdf } from './pdfText.js';
import { callAI, importPrompt, AIError } from './ai.js';
import { normalizeResume } from './resume.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// -> { resume, msg: { tone, text } }; resume is null when nothing usable was read
export async function importResumePdf(pid, file, fallbackName = '') {
  try {
    const { text, links, pages } = await readPdf(file);
    if (text.length < 300) return { resume: null, msg: { tone: 'warn', text: 'This PDF looks scanned or image based, so almost no text could be read. Try a text based PDF.' } };
    const { system, user } = importPrompt(text, links);
    const out = await callAI(pid, 'refine', system, user);
    const r = normalizeResume({ name: fallbackName, ...out });
    const nb = r.experience.reduce((n, x) => n + x.bullets.length, 0);
    const inc = (out.incomplete || []).filter(Boolean);
    return {
      resume: r,
      msg: inc.length
        ? { tone: 'warn', text: `Read ${plural(r.experience.length, 'role')} and ${plural(nb, 'bullet')}, but some parts look cut off: ${inc.slice(0, 2).join('; ')}. Check them below.` }
        : { tone: 'ok', text: `Read ${plural(r.experience.length, 'role')}, ${plural(nb, 'bullet')} and ${plural(r.skills.length, 'skill group')}${pages > 1 ? ` from ${pages} pages` : ''}.` },
    };
  } catch (err) {
    return { resume: null, msg: { tone: 'err', text: err instanceof AIError ? err.message : 'Could not read this PDF. Try another file.' } };
  }
}
