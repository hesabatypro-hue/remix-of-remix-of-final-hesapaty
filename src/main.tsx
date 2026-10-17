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

try {
  createRoot(root).render(<App />);
} catch (err: any) {
  console.error("Critical mount error:", err);
  root.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; direction: rtl; padding: 20px;">
      <div style="text-align: center; max-width: 450px; background: white; padding: 24px; border-radius: 12px; border: 1px solid #fee2e2; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h2 style="color: #ef4444; font-size: 1.25rem; font-weight: bold; margin-bottom: 8px;">حدث خطأ أثناء تشغيل التطبيق</h2>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 16px;">تعذر بدء تشغيل واجهة React. يرجى مراجعة تفاصيل الخطأ أدناه:</p>
        <pre style="direction: ltr; text-align: left; background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 11px; color: #dc2626; overflow: auto;">${err?.message || err}</pre>
        <button onclick="location.reload(true)" style="margin-top: 16px; padding: 8px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: inherit;">إعادة تحميل الصفحة</button>
      </div>
    </div>
  `;
}
