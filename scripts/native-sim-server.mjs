// Serves dist/ the way the Capacitor Android app does, for testing in a browser:
// a path without a file extension gets the root index.html, and every HTML page
// gets window.Capacitor injected first. Run: node scripts/native-sim-server.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const inject = '<script>window.Capacitor={isNativePlatform:function(){return true}};</script>';

createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (!extname(p)) p = '/index.html'; // Capacitor's fallback for folder-like paths
  try {
    let body = await readFile(join(root, p));
    const type = types[extname(p)] || 'application/octet-stream';
    if (type === 'text/html') body = Buffer.from(body.toString().replace('<head>', '<head>' + inject));
    res.writeHead(200, { 'Content-Type': type }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(5180, () => console.log('native sim on http://localhost:5180'));
