// Service worker: makes the app work offline and receives shared files.
// Bump VERSION whenever the files below change.
const VERSION = "v1";
const SHELL_CACHE = `catprinter-shell-${VERSION}`;
const RUNTIME_CACHE = "catprinter-runtime";
const SHARED_CACHE = "catprinter-shared";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/imaging.js",
  "./js/printer.js",
  "./js/protocol.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("catprinter-shell-") && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/compartir")) {
    event.respondWith(receiveShare(event.request));
  } else if (event.request.method === "GET" && url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (event.request.method === "GET" && url.hostname === "cdnjs.cloudflare.com") {
    // Versioned library URLs (pdf.js) never change: cache them for offline use.
    event.respondWith(cacheFirst(event.request));
  }
});

// Answers from the cache right away and refreshes it for the next visit.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  return network;
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Share target: keeps the shared files for the page, which reads them on load.
async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARED_CACHE);
  const files = form.getAll("archivos").filter((f) => f instanceof File);
  await Promise.all(files.map((file, i) => cache.put(`./compartido/${i}`, new Response(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
  }))));
  return Response.redirect("./?compartido", 303);
}
