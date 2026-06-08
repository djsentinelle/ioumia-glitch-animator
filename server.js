const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// SSE clients waiting for reload signal
const clients = new Set();

function broadcastReload() {
  for (const res of clients) {
    res.write('data: reload\n\n');
  }
}

// Watch the whole project directory for file changes
fs.watch(ROOT, { recursive: true }, (event, filename) => {
  if (!filename) return;
  if (filename.includes('node_modules') || filename.includes('.git')) return;
  console.log(`[reload] ${filename} changed`);
  broadcastReload();
});

const LIVERELOAD_SCRIPT = `
<script>
  const es = new EventSource('/__livereload');
  es.onmessage = () => location.reload();
</script>`;

const server = http.createServer((req, res) => {
  // Live-reload SSE endpoint
  if (req.url === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(':\n\n'); // initial comment to open stream
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let urlPath = req.url === '/' ? '/glitch-animator-mvp.html' : req.url;
  // try root first, then public/ for static assets
  let filePath = path.join(ROOT, urlPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT, 'public', urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });

    // Inject live-reload script before </body> in HTML files
    if (ext === '.html') {
      const html = data.toString().replace('</body>', LIVERELOAD_SCRIPT + '\n</body>');
      res.end(html);
    } else {
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Glitch Animator running at http://localhost:${PORT}`);
});
