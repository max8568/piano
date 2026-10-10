import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { VERSION } from './version.js';
import { hashOf, HASHED } from './release.js';

// 執行 sw.js 取出 PRECACHE（模擬最小的 Service Worker 環境）。
function runServiceWorker() {
  const sandbox = { self: { addEventListener() {}, location: { origin: '' } } };
  vm.runInNewContext(readFileSync('sw.js', 'utf8') + '\nthis.PRECACHE = PRECACHE; this.VERSION = VERSION; this.HASHES = HASHES;', sandbox);
  return sandbox;
}

function precacheList() {
  return runServiceWorker().PRECACHE;
}

// App 執行時會用到的檔案：除了測試、說明文件與開發設定以外的所有檔案。
function runtimeFiles(dir = '.') {
  const skip = /^(\.|node_modules$|README\.md$|package\.json$|release\.js$|sw\.js$|.*\.test\.js$|icons\/icon\.svg$)/;
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

test('畫面顯示的版本號與 Service Worker 的 VERSION 一致', () => {
  assert.equal(runServiceWorker().VERSION, VERSION);
});

test('Service Worker 的檔案指紋是最新的（改了檔案要執行 npm run release）', () => {
  const { HASHES } = runServiceWorker();
  const expected = Object.fromEntries(precacheList().filter((f) => HASHED.test(f)).map((f) => [f, hashOf(f)]));
  assert.deepEqual({ ...HASHES }, expected);
});
