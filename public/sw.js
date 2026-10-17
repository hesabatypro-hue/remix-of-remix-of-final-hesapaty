// Kill-switch service worker.
// The old offline cache served stale index.html pointing at deleted JS bundles,
// causing a blank white screen after every update. Any browser still running the
// old worker will fetch this file, wipe all caches, unregister itself and reload.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
