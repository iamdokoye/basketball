// Pickup League Service Worker (PWA Offline Caching)
const CACHE_NAME = "pickup-league-v1";

const STATIC_PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
];

// Install: pre-cache application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Continue even if initial pre-cache has a missed route
        return self.skipWaiting();
      }),
  );
});

// Activate: clean up older cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip dynamic API polling and voice transcriptions - let client outbox handle them
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (HTML pages): Network-First with Cache Fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: check cache for this specific page or fall back to cached root
          const cached = await caches.match(req);
          if (cached) return cached;
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Pickup League · Offline</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f1ec; color: #1a1a1a; padding: 2rem; text-align: center; }
                  .card { background: white; padding: 2rem; border-radius: 20px; max-width: 400px; margin: 4rem auto; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
                  p { color: #666; font-size: 0.95rem; line-height: 1.4; }
                  button { margin-top: 1.5rem; background: #fd651e; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 999px; font-weight: bold; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏀</div>
                  <h1>Court Offline</h1>
                  <p>You appear to have lost cell signal at the court. Any plays you score in open games are safely saved to your phone's queue and will sync when signal returns.</p>
                  <button onclick="window.location.reload()">Retry Connection</button>
                </div>
              </body>
            </html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }),
    );
    return;
  }

  // Static assets (Next.js chunks, fonts, icons): Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetched;
      }),
    );
  }
});
