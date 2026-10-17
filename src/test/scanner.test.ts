import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { injectScannerManifest } from '@/modules/scanner/utils/manifestInjector';
import { audioFeedback } from '@/modules/scanner/utils/audioFeedback';

describe('Scanner Module Architecture & Utilities', () => {
  beforeEach(() => {
    // Reset document head
    document.head.innerHTML = '<link rel="manifest" href="/manifest.json" />';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  describe('Scoped PWA Manifest Injector', () => {
    it('dynamically switches manifest link to /manifest-scanner.json', () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      expect(link?.getAttribute('href')).toBe('/manifest.json');

      const cleanup = injectScannerManifest();

      const updatedLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      expect(updatedLink?.getAttribute('href')).toBe('/manifest-scanner.json');

      // Cleanup restores original manifest
      cleanup();
      expect(updatedLink?.getAttribute('href')).toBe('/manifest.json');
    });

    it('creates a manifest link if none existed before', () => {
      document.head.innerHTML = '';
      const cleanup = injectScannerManifest();

      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('/manifest-scanner.json');

      cleanup();
    });
  });

  describe('Audio & Haptic Feedback Controller', () => {
    it('handles shutter sound without throwing in test environment', () => {
      expect(() => audioFeedback.playShutter()).not.toThrow();
    });

    it('handles success chime without throwing in test environment', () => {
      expect(() => audioFeedback.playSuccess()).not.toThrow();
    });

    it('handles alert buzzer without throwing in test environment', () => {
      expect(() => audioFeedback.playAlert()).not.toThrow();
    });

    it('handles vibration trigger gracefully when navigator.vibrate is undefined', () => {
      expect(() => audioFeedback.vibrate(50)).not.toThrow();
    });
  });
});
