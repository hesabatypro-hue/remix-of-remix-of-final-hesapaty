/**
 * Dynamically switches the document's PWA web manifest link
 * to point specifically to /manifest-scanner.json so that browser
 * install prompts (Chrome/Edge/Safari) install the dedicated Scoped Scanner app.
 */

const SCANNER_MANIFEST_HREF = '/manifest-scanner.json';
const DEFAULT_MANIFEST_HREF = '/manifest.json';

export function injectScannerManifest(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const originalHref = manifestLink?.getAttribute('href') || DEFAULT_MANIFEST_HREF;

  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }

  manifestLink.setAttribute('href', SCANNER_MANIFEST_HREF);

  // Return cleanup function to restore default manifest when leaving scanner page
  return () => {
    if (manifestLink) {
      manifestLink.setAttribute('href', originalHref);
    }
  };
}
