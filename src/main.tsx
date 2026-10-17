import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Root fix for recurring blank screens:
// 1) Never register a caching service worker; remove any old one and its caches.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  }
}

// 2) If a code chunk fails to load (stale page after an update), reload once.
const RELOAD_FLAG = "chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
  if (Date.now() - last > 10_000) {
    event.preventDefault();
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    window.location.reload();
  }
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element was not found");
}

createRoot(root).render(<App />);
