// Vector PDF of the resume, same design as the HTML preview. Links stay clickable.
import { Document, Page, View, Text, Link, Font, Svg, Defs, LinearGradient, Stop, Rect, pdf } from '@react-pdf/renderer';
import { segments } from './resume.js';
import { countPages } from './pdfText.js';

// Imported as URLs so Vite resolves them from any page path (/ or /app/)
import manrope700 from '../assets/pdf-fonts/manrope-latin-700-normal.woff?url';
import manrope800 from '../assets/pdf-fonts/manrope-latin-800-normal.woff?url';
import open400 from '../assets/pdf-fonts/open-sans-latin-400-normal.woff?url';
import open600 from '../assets/pdf-fonts/open-sans-latin-600-normal.woff?url';
import open700 from '../assets/pdf-fonts/open-sans-latin-700-normal.woff?url';
import open400i from '../assets/pdf-fonts/open-sans-latin-400-italic.woff?url';

const abs = (u) => new URL(u, document.baseURI).href;
Font.register({ family: 'Manrope', fonts: [{ src: abs(manrope700), fontWeight: 700 }, { src: abs(manrope800), fontWeight: 800 }] });
Font.register({ family: 'OpenSans', fonts: [
  { src: abs(open400), fontWeight: 400 }, { src: abs(open600), fontWeight: 600 },
  { src: abs(open700), fontWeight: 700 }, { src: abs(open400i), fontWeight: 400, fontStyle: 'italic' }] });
Font.registerHyphenationCallback((w) => [w]);

const ACC = '#F06434', INK = '#1F1D24', TXT = '#3B3941', MUT = '#6A6670', LINE = '#E6E3E8', PILL = '#FDEBE3', DOT = '#A9A6AE';
const B = (k, t) => <Text key={k} style={{ fontWeight: 700, color: INK }}>{t}</Text>;
const rich = (text) => segments(text).map((s, i) => (s.b ? B(i, s.t) : s.t));
const emailHref = (r) => r.emailUrl || `mailto:${r.email}`;

// Aadhavan's design: orange top bar, name and title left, contact right, date pills
function Studio({ r, fs }) {
  const lh = 1.45;
  const H = { fontFamily: 'Manrope', fontWeight: 800, color: INK, fontSize: fs * 0.95, letterSpacing: 1.3, textTransform: 'uppercase' };
  const section = (title, right) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `0.8pt solid ${LINE}`, paddingBottom: 4, marginTop: fs * 1.25, marginBottom: fs * 0.7 }}>
      <Text style={H}>{title}</Text>{right}
    </View>
  );
  const pill = (t) => <Text style={{ fontWeight: 700, fontSize: fs * 0.86, color: ACC, backgroundColor: PILL, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1.5 }}>{t}</Text>;
  const bullet = (b, i) => (
    <View key={i} style={{ flexDirection: 'row', marginBottom: fs * 0.32, paddingLeft: 2 }} wrap={false}>
      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: DOT, marginTop: fs * 0.6, marginRight: 7 }} />
      <Text style={{ flex: 1, fontSize: fs, lineHeight: lh }}>{b.label ? B('l', `${b.label}: `) : null}{rich(b.text)}</Text>
    </View>
  );
  const ul = { color: INK, fontWeight: 700, textDecoration: 'underline' };
  return (
    <>
      <Svg width={595.28} height={5} style={{ marginHorizontal: -40, marginBottom: 30 }}>
        <Defs><LinearGradient id="g" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={ACC} /><Stop offset="0.6" stopColor="#F5A27F" /><Stop offset="1" stopColor="#F9C9B4" /></LinearGradient></Defs>
        <Rect x="0" y="0" width="595.28" height="5" fill="url(#g)" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `0.8pt solid ${LINE}`, paddingBottom: 9 }}>
        <View>
          <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 25, color: INK, letterSpacing: -0.4 }}>{r.name}</Text>
          {r.title ? <Text style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: MUT, marginTop: 4 }}>{r.title}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', fontSize: fs * 0.92, lineHeight: 1.6 }}>
          {r.phone ? <Text>{r.phone}</Text> : null}
          {r.links.map((l, i) => <Link key={i} src={l.url} style={ul}>{l.label}</Link>)}
          {r.email ? <Link src={emailHref(r)} style={{ color: TXT, textDecoration: 'none' }}>{r.email}</Link> : null}
        </View>
      </View>
      {r.summary ? <Text style={{ marginTop: 11, fontSize: fs, lineHeight: lh }}>{rich(r.summary)}</Text> : null}
      {r.experience.length ? section('Professional Experience') : null}
      {r.experience.map((e, i) => (
        <View key={i} style={{ marginTop: i ? fs * 0.9 : 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }} wrap={false}>
            <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: fs * 1.02, color: INK }}>{e.role}{e.company ? ', ' : ''}{e.company ? <Text style={{ color: ACC }}>{e.company}</Text> : null}</Text>
            {e.dates ? pill(e.dates) : null}
          </View>
          {e.bullets.map(bullet)}
        </View>
      ))}
      {r.projects.length ? section('Projects') : null}
      {r.projects.map((p, i) => (
        <View key={i} style={{ marginTop: i ? fs * 0.7 : 0 }}>
          <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: fs, color: INK, marginBottom: 3 }}>{p.name}</Text>
          {p.bullets.map(bullet)}
        </View>
      ))}
      {r.education.length ? section('Education') : null}
      {r.education.map((e, i) => (
        <View key={i} style={{ marginBottom: 3 }} wrap={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: fs * 1.02, color: INK }}>{e.school}</Text>
            {e.dates ? pill(e.dates) : null}
          </View>
          <Text style={{ color: MUT, marginTop: 1 }}>{e.degree}</Text>
        </View>
      ))}
      {r.skills.length ? section('Skills', r.skillsLink?.url ? <Link src={r.skillsLink.url} style={{ ...ul, fontSize: fs * 0.82, fontWeight: 600 }}>{r.skillsLink.label || 'Proof of Skills'}</Link> : null) : null}
      {r.skills.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: fs * 0.35 }} wrap={false}>
          <Text style={{ width: 114, fontSize: fs, fontWeight: 700, color: INK, lineHeight: lh }}>{s.label}</Text>
          <Text style={{ flex: 1, fontSize: fs, lineHeight: lh }}>{s.items}</Text>
        </View>
      ))}
    </>
  );
}

// Gayathri's design: classic black and white, URLs written out, labelled sections with a rule
function Classic({ r, fs }) {
  const lh = 1.4; const K = '#000000'; const T = { fontSize: fs, lineHeight: lh };
  const section = (title) => (
    <View style={{ borderBottom: `0.9pt solid ${K}`, paddingBottom: 1.5, marginTop: fs * 1.15, marginBottom: fs * 0.4 }} wrap={false}>
      <Text style={{ ...T, fontWeight: 700, color: K }}>{title.toUpperCase()}:</Text>
    </View>
  );
  const dot = (w) => <View style={{ width: w, alignItems: 'center', paddingTop: fs * 0.5 }}><View style={{ width: 3.6, height: 3.6, borderRadius: 2, backgroundColor: K }} /></View>;
  const bullet = (b, i) => (
    <View key={i} style={{ flexDirection: 'row', marginBottom: 1.5, paddingLeft: 14 }} wrap={false}>
      {dot(22)}
      <Text style={{ ...T, flex: 1 }}>{b.label ? `${b.label}: ` : ''}{segments(b.text).map((s) => s.t).join('')}</Text>
    </View>
  );
  const head = (left, right, k) => (
    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }} wrap={false}>
      <Text style={{ ...T, fontWeight: 700, color: K, flex: 1 }}>{left}</Text><Text style={{ ...T, color: K }}>{right}</Text>
    </View>
  );
  const items = r.skills.map((s) => (s.label ? `${s.label}: ${s.items}` : s.items));
  const perCol = Math.ceil(items.length / 4) || 1;
  const cols = [0, 1, 2, 3].map((c) => items.slice(c * perCol, c * perCol + perCol));
  return (
    <View style={{ paddingTop: 34, color: K }}>
      <Text style={{ fontWeight: 700, fontSize: 19, color: K, marginBottom: 6 }}>{r.name}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          {r.email ? (r.emailUrl ? <Link src={r.emailUrl} style={{ ...T, color: K, textDecoration: 'none' }}>{r.email}</Link> : <Text style={T}>{r.email}</Text>) : null}
          {r.links.map((l, i) => <Link key={i} src={l.url} style={{ ...T, color: '#1155CC', textDecoration: 'underline' }}>{l.url}</Link>)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {r.phone ? <Text style={T}>{r.phone}</Text> : null}
          {r.location ? <Text style={T}>{r.location}</Text> : null}
        </View>
      </View>
      {r.summary ? <>{section('Summary')}<Text style={T}>{segments(r.summary).map((s) => s.t).join('')}</Text></> : null}
      {items.length ? <>{section('Skills')}
        <View style={{ flexDirection: 'row' }}>{cols.map((c, ci) => (
          <View key={ci} style={{ flex: 1, paddingRight: 6 }}>{c.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>{dot(12)}<Text style={{ ...T, lineHeight: 1.3, flex: 1 }}>{t}</Text></View>
          ))}</View>
        ))}</View></> : null}
      {r.experience.length ? section('Experience') : null}
      {r.experience.map((e, i) => (
        <View key={i} style={{ marginTop: i ? fs * 0.6 : 0 }}>
          {head(`${e.company}${e.company && e.role ? ' – ' : ''}${e.role}`, e.dates, 'h')}
          {e.bullets.map(bullet)}
        </View>
      ))}
      {r.projects.length ? section('Project') : null}
      {r.projects.map((p, i) => (
        <View key={i} style={{ marginTop: i ? fs * 0.4 : 0 }}>
          <Text style={{ ...T, fontWeight: 700, color: K, marginBottom: 2 }}>{p.name}:</Text>
          {p.bullets.map(bullet)}
        </View>
      ))}
      {r.education.length ? section('Education') : null}
      {r.education.map((e, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }} wrap={false}>
          <Text style={{ ...T, flex: 1 }}>{e.degree}{e.degree && e.school ? ' - ' : ''}{e.school}</Text><Text style={T}>{e.dates}</Text>
        </View>
      ))}
    </View>
  );
}

function ResumeDoc({ r, size }) {
  const classic = r.template === 'classic';
  return (
    <Document title={`Resume - ${r.name}`} author={r.name}>
      <Page size="A4" style={{ fontFamily: 'OpenSans', color: TXT, fontSize: size, paddingTop: 0, paddingBottom: 30, paddingHorizontal: classic ? 34 : 40 }}>
        {classic ? <Classic r={r} fs={size} /> : <Studio r={r} fs={size} />}
      </Page>
    </Document>
  );
}

export const SIZES = [10.6, 10.3, 10, 9.7, 9.4, 9.1, 8.8];
export const CLASSIC_SIZES = [10, 9.7, 9.4, 9.1, 8.8, 8.5];

// Largest body size (pt) that keeps it on one page
export async function buildPdf(resume) {
  const sizes = resume.template === 'classic' ? CLASSIC_SIZES : SIZES;
  let last = null;
  for (const s of sizes) {
    const blob = await pdf(<ResumeDoc r={resume} size={s} />).toBlob();
    const n = await countPages(blob);
    last = { blob, size: s, pages: n };
    if (n === 1) return last;
  }
  return last; // still over one page at the smallest size
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
