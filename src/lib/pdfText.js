// Extract text and link URLs from an uploaded resume PDF, in the browser.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = ''; const links = new Set();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    for (const item of content.items) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'; else if (lastY !== null) text += ' ';
      text += item.str; lastY = y;
    }
    text += '\n\n';
    const ann = await page.getAnnotations();
    ann.forEach((a) => { if (a.url) links.add(a.url); });
  }
  return { text: text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), links: [...links], pages: doc.numPages };
}

export async function countPages(blob) {
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  return doc.numPages;
}
