// 發佈新版：`npm run release`
// 1. version.js 與 sw.js 的 VERSION 加一
// 2. 重算 sw.js 裡 HASHES（程式與頁面檔案的指紋），讓 Service Worker 安裝時能確認拿到的是這一版的檔案
// 只帶 --hashes 時只重算指紋、不加版本號。
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const HASHED = /\.(html|css|js|webmanifest)$/;

export function hashOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}

// sw.js 裡 HASHES 區塊應有的內容。
export function hashesBlock(precache) {
  const lines = precache.filter((f) => HASHED.test(f)).map((f) => `  '${f}': '${hashOf(f)}',`);
  return `// HASHES-BEGIN\nconst HASHES = {\n${lines.join('\n')}\n};\n// HASHES-END`;
}

export function precacheOf(swSource) {
  const files = [...swSource.matchAll(/^  '([^']+)',$/gm)].map((m) => m[1]);
  return files.filter((f) => f !== './');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bump = !process.argv.includes('--hashes');
  let version = readFileSync('version.js', 'utf8');
  let sw = readFileSync('sw.js', 'utf8');
  if (bump) {
    const next = Number(version.match(/VERSION = (\d+);/)[1]) + 1;
    version = version.replace(/VERSION = \d+;/, `VERSION = ${next};`);
    sw = sw.replace(/const VERSION = \d+;/, `const VERSION = ${next};`);
    writeFileSync('version.js', version);
    console.log(`版本 → v${next}`);
  }
  // 先寫入 version.js 再算指紋（它也在指紋清單裡）。
  const precache = precacheOf(sw.replace(/\/\/ HASHES-BEGIN[\s\S]*\/\/ HASHES-END/, ''));
  sw = sw.replace(/\/\/ HASHES-BEGIN[\s\S]*\/\/ HASHES-END/, hashesBlock(precache));
  writeFileSync('sw.js', sw);
  console.log('已更新 sw.js 的 HASHES');
}
