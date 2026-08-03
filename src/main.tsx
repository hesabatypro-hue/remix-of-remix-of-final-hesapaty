import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {});
      return;
    }
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      ),
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    ]).catch(() => {});
  });
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element was not found");
}

createRoot(root).render(<App />);
