// Vector PDF of the resume, same design as the HTML preview. Links stay clickable.
import { Document, Page, View, Text, Link, Font, Svg, Defs, LinearGradient, Stop, Rect, pdf } from '@react-pdf/renderer';
import { isNative, saveNative } from './native.js';
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

const ACC = '#F06434', INK = '#1F1D24', TXT = '#3B3941', MUT = '#6A6670', LINE = '#FBDCCF';

function Rich({ text, style }) {
  return <Text style={style}>{segments(text).map((s, i) => s.b ? <Text key={i} style={{ fontWeight: 700, color: INK }}>{s.t}</Text> : s.t)}</Text>;
}

function ResumeDoc({ r, size }) {
  const fs = size, lh = 1.45;
  const H = { fontFamily: 'Manrope', fontWeight: 800, color: ACC, fontSize: fs * 0.95, letterSpacing: 1.3, textTransform: 'uppercase' };
  const section = (title, right) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `0.8pt solid ${LINE}`, paddingBottom: 3, marginTop: fs * 1.15, marginBottom: fs * 0.6 }}>
      <Text style={H}>{title}</Text>{right}
    </View>
  );
  const bullet = (b, i) => (
    <View key={i} style={{ flexDirection: 'row', marginBottom: fs * 0.32, paddingLeft: 2 }} wrap={false}>
      <View style={{ width: 3.4, height: 3.4, borderRadius: 2, backgroundColor: ACC, marginTop: fs * 0.55, marginRight: 7 }} />
      <Text style={{ flex: 1, fontSize: fs, lineHeight: lh }}>{b.label ? <Text style={{ fontWeight: 700, color: INK }}>{b.label}: </Text> : null}{segments(b.text).map((s, k) => s.b ? <Text key={k} style={{ fontWeight: 700, color: INK }}>{s.t}</Text> : s.t)}</Text>
    </View>
  );
  return (
    <Document title={`Resume - ${r.name}`} author={r.name}>
      <Page size="A4" style={{ fontFamily: 'OpenSans', color: TXT, fontSize: fs, paddingTop: 0, paddingBottom: 30, paddingHorizontal: 40 }}>
        <Svg width={595.28} height={5} style={{ marginHorizontal: -40, marginBottom: 30 }}>
          <Defs><LinearGradient id="g" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={ACC} /><Stop offset="0.6" stopColor="#F5A27F" /><Stop offset="1" stopColor="#F9C9B4" /></LinearGradient></Defs>
          <Rect x="0" y="0" width="595.28" height="5" fill="url(#g)" />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `0.8pt solid ${LINE}`, paddingBottom: 9 }}>
          <View>
            <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 24, color: INK, letterSpacing: -0.3 }}>{r.name}</Text>
            {r.title ? <Text style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: ACC, marginTop: 5 }}>{r.title}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', fontSize: fs * 0.92, lineHeight: 1.55 }}>
            {r.phone ? <Text>{r.phone}</Text> : null}
            {r.links.map((l, i) => <Link key={i} src={l.url} style={{ color: ACC, fontWeight: 600 }}>{l.label}</Link>)}
            {r.email ? <Link src={`mailto:${r.email}`} style={{ color: TXT, textDecoration: 'none' }}>{r.email}</Link> : null}
          </View>
        </View>
        {r.summary ? <Rich text={r.summary} style={{ marginTop: 10, fontSize: fs, lineHeight: lh }} /> : null}
        {r.experience.length ? section('Professional Experience') : null}
        {r.experience.map((e, i) => (
          <View key={i} style={{ marginTop: i ? fs * 0.9 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }} wrap={false}>
              <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: fs * 1.02, color: INK }}>{e.role}{e.company ? `, ${e.company}` : ''}</Text>
              <Text style={{ fontWeight: 600, fontSize: fs * 0.9, color: MUT }}>{e.dates}</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: fs * 1.02, color: INK }}>{e.school}</Text>
              <Text style={{ fontWeight: 600, fontSize: fs * 0.9, color: MUT }}>{e.dates}</Text>
            </View>
            <Text style={{ color: MUT }}>{e.degree}</Text>
          </View>
        ))}
        {r.skills.length ? section('Skills', r.skillsLink?.url ? <Link src={r.skillsLink.url} style={{ fontSize: fs * 0.85, fontWeight: 600, color: ACC }}>{r.skillsLink.label || 'Proof of Skills'}</Link> : null) : null}
        {r.skills.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: fs * 0.3 }} wrap={false}>
            <Text style={{ width: 108, fontWeight: 700, color: INK, lineHeight: lh }}>{s.label}</Text>
            <Text style={{ flex: 1, lineHeight: lh }}>{s.items}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// Largest body size (pt) that keeps it on one page
export async function buildPdf(resume) {
  const sizes = [10.6, 10.3, 10, 9.7, 9.4, 9.1, 8.8];
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
  if (isNative) return saveNative(blob, name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
