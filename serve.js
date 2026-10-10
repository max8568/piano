// 本機開發伺服器：`npm run serve`，iPad 連同一個 Wi-Fi 就能直接測試，不用推上 GitHub Pages。
// - 監聽所有網路介面，並印出 iPad 要開的網址。
// - 每個回應都帶 Cache-Control: no-store，改完檔案在 iPad 重新整理就是新版。
// 用區網 IP（http）開啟時不算安全環境，瀏覽器不提供 Service Worker，所以不會有離線快取卡住舊檔；
// 但也表示離線功能、加入主畫面後的離線行為要在 GitHub Pages 上測。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve('.');
const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = resolve(ROOT, '.' + (path.endsWith('/') ? join(path, 'index.html') : path));
    if (!file.startsWith(ROOT + sep)) throw new Error('只提供專案資料夾裡的檔案');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Cache-Control': 'no-store' });
    res.end('Not found');
  }
  console.log(`${res.statusCode} ${req.url}`);
}).listen(PORT, () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`本機：http://localhost:${PORT}`);
  for (const ip of ips) console.log(`iPad：http://${ip}:${PORT}`);
});
