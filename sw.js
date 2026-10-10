// Service Worker：預先快取所有檔案，讓 App 可以離線使用（含鋼琴取樣）。
//
// 更新策略：頁面與程式先用快取回應（開啟快、離線可用），同時在背景抓新版存進快取，
// 所以推上新版後，下次開啟 App 就會是新版。取樣音檔不會變，只用快取。
// 每次發佈新版都把 VERSION 加一（並同步 version.js，畫面左上角會顯示），新版會立刻接手並清掉舊快取。
const VERSION = 8;
const CACHE = `piano-v${VERSION}`;

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
  'vendor/vexflow.js',
  'vendor/tone.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'audio/silence.wav',
  ...SAMPLES,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
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

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached && request.url.endsWith('.mp3')) return cached;

      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return refresh;
    }),
  );
});
