import type { CapturedImagePayload } from '../types';

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg';
}

/**
 * Compresses an image from an HTMLVideoElement or existing Image/Blob
 * while maintaining aspect ratio and generating both a binary Blob and a base64 DataURL.
 */
export async function captureAndCompressFromVideo(
  video: HTMLVideoElement,
  options: CompressOptions = {}
): Promise<CapturedImagePayload> {
  const {
    maxDimension = 1600,
    quality = 0.85,
    mimeType = 'image/webp',
  } = options;

  const naturalWidth = video.videoWidth || 1280;
  const naturalHeight = video.videoHeight || 720;

  // Calculate target dimensions keeping aspect ratio
  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not obtain 2D canvas context for image capture');
  }

  // Draw current video frame to canvas
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  // Convert to Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob conversion failed'));
      },
      mimeType,
      quality
    );
  });

  const dataUrl = canvas.toDataURL(mimeType, quality);

  return {
    blob,
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    sizeBytes: blob.size,
  };
}

/**
 * Compresses an image File (e.g. from file picker) using canvas
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<CapturedImagePayload> {
  const {
    maxDimension = 1600,
    quality = 0.85,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth;
      let targetHeight = img.naturalHeight;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        reject(new Error('Could not obtain canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error('Canvas compression failed'));
            return;
          }
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve({
            blob: b,
            dataUrl,
            width: targetWidth,
            height: targetHeight,
            sizeBytes: b.size,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file for compression'));
    };

    img.src = objectUrl;
  });
}
