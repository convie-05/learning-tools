const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname);
const mime = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'application/javascript;charset=utf-8', '.json':'application/json;charset=utf-8', '.ico':'image/x-icon' };
http.createServer((req, res) => {
    let fp = path.join(root, decodeURIComponent(req.url.split('?')[0] || 'index.html'));
    if (!fp.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
    fs.stat(fp, (e, st) => {
        if (e || !st.isFile()) { fp = path.join(root, 'index.html'); }
        fs.readFile(fp, (err, data) => {
            if (err) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': (mime[path.extname(fp)]||'application/octet-stream') });
            res.end(data);
        });
    });
}).listen(8765, () => console.log('Vocab static server on http://localhost:8765'));
