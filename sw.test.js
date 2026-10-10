import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// 執行 sw.js 取出 PRECACHE（模擬最小的 Service Worker 環境）。
function precacheList() {
  const sandbox = { self: { addEventListener() {}, location: { origin: '' } } };
  vm.runInNewContext(readFileSync('sw.js', 'utf8') + '\nthis.PRECACHE = PRECACHE;', sandbox);
  return sandbox.PRECACHE;
}

// App 執行時會用到的檔案：除了測試、說明文件與開發設定以外的所有檔案。
function runtimeFiles(dir = '.') {
  const skip = /^(\.|node_modules$|README\.md$|package\.json$|sw\.js$|.*\.test\.js$|icons\/icon\.svg$)/;
  return readdirSync(dir).flatMap((name) => {
    const path = dir === '.' ? name : join(dir, name);
    if (skip.test(name) || skip.test(path)) return [];
    return statSync(path).isDirectory() ? runtimeFiles(path) : [path];
  });
}

test('Service Worker 預先快取了所有 App 會用到的檔案', () => {
  const precache = new Set(precacheList());
  const missing = runtimeFiles().filter((f) => !precache.has(f));
  assert.deepEqual(missing, []);
});

test('預先快取清單裡的檔案都存在', () => {
  for (const path of precacheList()) {
    if (path === './') continue;
    assert.ok(statSync(path).isFile(), path);
  }
});
