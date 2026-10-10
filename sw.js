// Service Worker：預先快取所有檔案，讓 App 可以離線使用（含鋼琴取樣）。
//
// 更新策略：一律用快取回應（開啟快、離線可用）。一個快取裡的檔案永遠來自同一次安裝，
// 不在背景零星更新，避免新舊檔案混雜（例如新的 index.html 配舊的 app.js）。
// 發佈新版時執行 `npm run release`：VERSION 加一（同步 version.js，畫面左上角會顯示）並重算 HASHES。
// sw.js 內容一變，瀏覽器就會安裝新版；新版下載完所有檔案、核對過指紋才接手並清掉舊快取。
const VERSION = 19;
const CACHE = `piano-v${VERSION}`;

// 程式與頁面檔案的 SHA-256 指紋（前 16 碼），由 `npm run release` 產生，npm test 會檢查是否最新。
// 安裝時下載到的檔案若與指紋不符（例如 CDN 或瀏覽器給了舊檔），就放棄這次安裝，
// 舊版繼續完整運作，下次開啟 App 再重試。
// HASHES-BEGIN
const HASHES = {
  'index.html': '03169f4e2b5c0399',
  'styles.css': '51dffabc728cb46d',
  'app.js': '8913909a73198b87',
  'version.js': '5301a06e8091984c',
  'music.js': '996c1d0011673ed4',
  'score.js': '3cf5871882284905',
  'staff.js': 'e4b4a7f5efe40bea',
  'keyboard.js': 'b870788ebdfe1e32',
  'delete-gesture.js': '57443a43b0137fcd',
  'sound.js': '369bf981761a1ca0',
  'intro.js': '35c55aaeb642e48d',
  'quiz.js': 'f26d612d91ab31a2',
  'vendor/vexflow.js': 'e99d9f8d7ebcb88f',
  'vendor/tone.js': 'a2434ccdddd2b477',
  'manifest.webmanifest': '1d3126ac2dcd2204',
};
// HASHES-END

const SAMPLES = ['C', 'Ds', 'Fs', 'A']
  .flatMap((note) => [2, 3, 4, 5].map((octave) => `audio/salamander/${note}${octave}.mp3`))
  .concat('audio/salamander/C6.mp3');

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'version.js',
  'music.js',
  'score.js',
  'staff.js',
  'keyboard.js',
  'delete-gesture.js',
  'sound.js',
  'intro.js',
  'quiz.js',
  'vendor/vexflow.js',
  'vendor/tone.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'audio/silence.wav',
  ...SAMPLES,
];

// GitHub Pages 對每個檔案都回 max-age=600，Service Worker 的下載預設會用瀏覽器的 HTTP 快取，
// 剛推新版的 10 分鐘內可能抓到舊檔。所以一律用 cache: 'no-cache' 向伺服器確認（沒變只回 304，不會重新下載）。
async function download(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const expected = HASHES[url === './' ? 'index.html' : url];
  if (expected) {
    const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
    const actual = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    if (actual !== expected) throw new Error(`${url} 不是這一版的檔案`);
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const responses = await Promise.all(PRECACHE.map(download));
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map((url, i) => cache.put(url, responses[i])));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('piano-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)));
});
