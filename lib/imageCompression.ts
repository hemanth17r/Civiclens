/**
 * Zero-dependency client-side image compression utility.
 * Resizes large smartphone camera photos (4K / 12-48MP) down to a crisp,
 * mobile-friendly resolution (max 1280px) and converts to WebP/JPEG at 80% quality.
 * Typical reduction: 10MB -> ~150-250KB (98% reduction) in ~50ms.
 */

export interface CompressionOptions {
    maxDimension?: number; // default: 1280
    quality?: number;      // default: 0.8 (80%)
    format?: 'image/webp' | 'image/jpeg';
}

/**
 * Calculates proportionally scaled dimensions constrained to maxDimension.
 */
export function calculateAspectRatioDimensions(
    srcWidth: number,
    srcHeight: number,
    maxDimension: number
): { width: number; height: number } {
    if (srcWidth <= 0 || srcHeight <= 0) {
        return { width: maxDimension, height: maxDimension };
    }

    if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
        return { width: srcWidth, height: srcHeight };
    }

    if (srcWidth >= srcHeight) {
        const ratio = maxDimension / srcWidth;
        return {
            width: maxDimension,
            height: Math.max(1, Math.round(srcHeight * ratio)),
        };
    } else {
        const ratio = maxDimension / srcHeight;
        return {
            width: Math.max(1, Math.round(srcWidth * ratio)),
            height: maxDimension,
        };
    }
}

/**
 * Compresses an image file before upload.
 * If file is not an image or already under 150KB, returns file as-is.
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const { maxDimension = 1280, quality = 0.8, format = 'image/webp' } = options;

    // 1. Guard: Only process image files
    if (!file.type.startsWith('image/')) {
        return file;
    }

    // 2. Guard: If already tiny (< 150KB), no compression needed
    if (file.size < 150 * 1024) {
        return file;
    }

    // 3. Browser environment check
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return file;
    }

    try {
        const bitmap = await loadImage(file);
        const { width, height } = calculateAspectRatioDimensions(
            bitmap.width,
            bitmap.height,
            maxDimension
        );

        // If image is already smaller than maxDimension and under 400KB, keep original
        if (bitmap.width <= maxDimension && bitmap.height <= maxDimension && file.size < 400 * 1024) {
            return file;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        // High quality bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);

        // Export to WebP (or fallback to JPEG if WebP is unsupported)
        let blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, format, quality)
        );

        if (!blob && format === 'image/webp') {
            blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', quality)
            );
        }

        if (!blob) return file;

        // Build replacement File object
        const newExtension = blob.type === 'image/webp' ? '.webp' : '.jpg';
        const originalBaseName = file.name.replace(/\.[^/.]+$/, '');
        const newFileName = `${originalBaseName}${newExtension}`;

        return new File([blob], newFileName, {
            type: blob.type,
            lastModified: Date.now(),
        });
    } catch (err) {
        console.warn('Image compression fallback to original:', err);
        return file; // Graceful fallback on any failure
    }
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(objectUrl);
            reject(e);
        };
        img.src = objectUrl;
    });
}
