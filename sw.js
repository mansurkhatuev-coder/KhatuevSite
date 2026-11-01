const CACHE_PREFIX = "khatuev-pwa-";
const CACHE_VERSION = "v15";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
const SCOPE_URL = new URL(self.registration.scope);
const OFFLINE_URL = new URL("offline.html", SCOPE_URL).href;

const CORE_ASSETS = [
  "index.html",
  "knigi.html",
  "stikhi.html",
  "kontakty.html",
  "reader.html",
  "offline.html",
  "manifest.webmanifest",
  "css/style-v39.css",
  "css/reader.css?v=5",
  "css/poems-reading.css?v=1",
  "css/poem-export.css?v=1",
  "css/voice-player.css?v=1",
  "js/main.js?v=21",
  "js/pwa.js?v=1",
  "js/book-reader.js?v=3",
  "js/poem-export.js?v=1",
  "js/poem-export-backgrounds.js",
  "js/poem-export-content.js",
  "js/poem-export-renderer.js",
  "js/vendor/pdfjs/pdf.min.mjs",
  "js/vendor/pdfjs/pdf.worker.min.mjs",
  "images/icons/pwa-book-towers-192.png",
  "images/icons/pwa-book-towers-512.png",
  "images/icons/pwa-book-towers-maskable-512.png",
  "images/icons/apple-touch-book-towers-180.png",
  "images/ushkaloy-hero-photoreal-20261101.webp",
  "images/portrait-official.jpg",
  "images/portrait-official.jpg?v=5",
  "images/portrait-bw.jpg",
  "images/portrait-conference.jpg",
  "images/portrait-writers.jpg",
  "images/portrait-young.jpg",
  "images/covers/arzunan.webp?v=2",
  "images/covers/beriin.webp?v=2",
  "images/covers/mudrost-tebe-mudrost-mne.webp",
  "images/covers/busulba.webp?v=2",
  "images/covers/rasstrel.webp?v=2",
  "images/covers/yahalah.webp?v=2",
  "images/ornaments/chechen-rosette.svg?v=2",
  "images/ornaments/chechen-scroll-divider.svg?v=2",
  "images/ornaments/chechen-vertical-border.svg?v=2",
  "images/ornaments/chechen-woven-border.webp?v=1",
  "images/poem-backgrounds/ushkaloy-dawn.webp",
  "images/poem-backgrounds/mountain-sunset.webp",
  "images/poem-backgrounds/rainy-mountains.webp",
  "images/poem-backgrounds/morning-valley.webp",
  "images/poem-backgrounds/chechen-mist-gorge.webp",
  "images/poem-backgrounds/chechen-blue-hour.webp",
  "images/poem-backgrounds/chechen-moonlit-tower.webp"
];

const toScopedUrl = (path) => new URL(path, SCOPE_URL).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS.map(toScopedUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const filesPath = new URL("files/", SCOPE_URL).pathname;
  const audioPath = new URL("audio/", SCOPE_URL).pathname;
  if (
    url.pathname.startsWith(filesPath) ||
    url.pathname.startsWith(audioPath) ||
    request.headers.has("range")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    const cachePromise = caches.open(SHELL_CACHE);
    event.respondWith((async () => {
      const cache = await cachePromise;
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
      } catch (_) {
        // Use the cached page when the network is unavailable.
      }
      return (await cache.match(request, { ignoreSearch: true })) ||
        (await cache.match(OFFLINE_URL)) ||
        Response.error();
    })());
    return;
  }

  if (!["style", "script", "image", "font", "manifest"].includes(request.destination)) return;

  const cachePromise = caches.open(ASSET_CACHE);
  const refreshPromise = cachePromise.then(async (cache) => {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(refreshPromise.catch(() => undefined));
  const shellCachePromise = caches.open(SHELL_CACHE);
  event.respondWith(Promise.all([cachePromise, shellCachePromise]).then(async ([cache, shellCache]) =>
    (await cache.match(request)) ||
    (await shellCache.match(request, { ignoreSearch: true })) ||
    refreshPromise
  ));
});
