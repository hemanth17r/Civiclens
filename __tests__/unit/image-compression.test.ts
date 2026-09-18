import { describe, it, expect } from 'vitest';
import { calculateAspectRatioDimensions } from '@/lib/imageCompression';

describe('Image Compression Utilities', () => {
    it('scales landscape dimensions down to maxDimension preserving aspect ratio', () => {
        // 4000x3000 landscape scaled to 1280
        const result = calculateAspectRatioDimensions(4000, 3000, 1280);
        expect(result.width).toBe(1280);
        expect(result.height).toBe(960);
    });

    it('scales portrait dimensions down to maxDimension preserving aspect ratio', () => {
        // 3000x4000 portrait scaled to 1280
        const result = calculateAspectRatioDimensions(3000, 4000, 1280);
        expect(result.height).toBe(1280);
        expect(result.width).toBe(960);
    });

    it('scales square dimensions accurately', () => {
        const result = calculateAspectRatioDimensions(2048, 2048, 1080);
        expect(result.width).toBe(1080);
        expect(result.height).toBe(1080);
    });

    it('leaves dimensions unchanged if already smaller than maxDimension', () => {
        const result = calculateAspectRatioDimensions(800, 600, 1280);
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
    });

    it('handles edge case of zero or negative dimensions safely', () => {
        const result = calculateAspectRatioDimensions(0, 0, 1280);
        expect(result.width).toBe(1280);
        expect(result.height).toBe(1280);
    });
});
