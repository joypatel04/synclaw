// Unregister this service worker immediately.
// Auth is managed via localStorage, no SW needed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => self.clients.claim()),
  );
});
