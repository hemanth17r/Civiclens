import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAspectRatioDimensions, compressImage } from '@/lib/imageCompression';

describe('Image Compression Utilities', () => {
    describe('calculateAspectRatioDimensions', () => {
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

        it('scales wide panoramic 16:9 dimensions down correctly', () => {
            // 3840x2160 (4K UHD) scaled to 1280
            const result = calculateAspectRatioDimensions(3840, 2160, 1280);
            expect(result.width).toBe(1280);
            expect(result.height).toBe(720);
        });

        it('scales tall phone screenshot 9:16 dimensions down correctly', () => {
            // 1080x1920 scaled to 1280
            const result = calculateAspectRatioDimensions(1080, 1920, 1280);
            expect(result.height).toBe(1280);
            expect(result.width).toBe(720);
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

    describe('compressImage guards & SSR resilience', () => {
        it('bypasses non-image files and returns original file', async () => {
            const textFile = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
            const result = await compressImage(textFile);
            expect(result).toBe(textFile);
            expect(result.name).toBe('notes.txt');
        });

        it('bypasses already tiny image files (< 150KB) without re-encoding', async () => {
            // Create a small 50KB dummy file
            const smallData = new Uint8Array(50 * 1024);
            const smallFile = new File([smallData], 'tiny.jpg', { type: 'image/jpeg' });
            const result = await compressImage(smallFile);
            expect(result).toBe(smallFile);
        });

        it('safely falls back to original file if executed on server without window/document', async () => {
            const largeData = new Uint8Array(200 * 1024);
            const file = new File([largeData], 'photo.jpg', { type: 'image/jpeg' });
            
            // In Node environment without window/document mock, it returns original file
            const result = await compressImage(file);
            expect(result).toBe(file);
        });
    });

    describe('compressImage full browser compression lifecycle', () => {
        const originalWindow = global.window;
        const originalDocument = global.document;
        const originalImage = global.Image;
        const originalURL = global.URL;

        let mockDrawImage: any;
        let mockToBlob: any;
        let mockRevokeObjectURL: any;

        beforeEach(() => {
            mockDrawImage = vi.fn();
            mockToBlob = vi.fn((callback: (blob: Blob | null) => void, format: string, quality: number) => {
                const compressedBlob = new Blob(['compressed-image-data'], { type: format });
                callback(compressedBlob);
            });
            mockRevokeObjectURL = vi.fn();

            // Mock browser environment
            global.window = {} as any;
            global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/dummy-id');
            global.URL.revokeObjectURL = mockRevokeObjectURL;

            // Mock Image loader
            global.Image = class {
                width = 4032;
                height = 3024;
                onload: () => void = () => {};
                onerror: (e: any) => void = () => {};
                set src(_url: string) {
                    setTimeout(() => {
                        if (this.onload) this.onload();
                    }, 0);
                }
            } as any;

            // Mock Canvas
            global.document = {
                createElement: vi.fn((tag: string) => {
                    if (tag === 'canvas') {
                        return {
                            width: 0,
                            height: 0,
                            getContext: vi.fn(() => ({
                                imageSmoothingEnabled: false,
                                imageSmoothingQuality: 'low',
                                drawImage: mockDrawImage,
                            })),
                            toBlob: mockToBlob,
                        };
                    }
                    return {};
                }),
            } as any;
        });

        afterEach(() => {
            global.window = originalWindow;
            global.document = originalDocument;
            global.Image = originalImage;
            global.URL = originalURL;
            vi.restoreAllMocks();
        });

        it('resizes 4K image down to 1280px and outputs WebP at 80% quality', async () => {
            const largeData = new Uint8Array(2 * 1024 * 1024); // 2MB dummy file
            const file = new File([largeData], 'camera_photo.jpg', { type: 'image/jpeg' });

            const result = await compressImage(file, { maxDimension: 1280, quality: 0.8 });

            // Verified scaled dimensions: 4032x3024 -> 1280x960
            expect(mockDrawImage).toHaveBeenCalledWith(
                expect.anything(),
                0,
                0,
                1280,
                960
            );

            // Verified WebP encoding with 0.8 quality
            expect(mockToBlob).toHaveBeenCalledWith(
                expect.any(Function),
                'image/webp',
                0.8
            );

            // Verified new file extension and type
            expect(result.name).toBe('camera_photo.webp');
            expect(result.type).toBe('image/webp');
            expect(mockRevokeObjectURL).toHaveBeenCalled();
        });

        it('falls back to JPEG if browser does not support WebP export', async () => {
            // Simulate browser that rejects webp blob (returns null) but accepts jpeg
            mockToBlob.mockImplementation((callback: any, format: string, quality: number) => {
                if (format === 'image/webp') {
                    callback(null);
                } else {
                    callback(new Blob(['jpeg-data'], { type: 'image/jpeg' }));
                }
            });

            const largeData = new Uint8Array(2 * 1024 * 1024);
            const file = new File([largeData], 'pothole.png', { type: 'image/png' });

            const result = await compressImage(file, { maxDimension: 1280, quality: 0.8 });

            expect(result.name).toBe('pothole.jpg');
            expect(result.type).toBe('image/jpeg');
        });

        it('falls back gracefully to original file if image load fails', async () => {
            // Mock Image that triggers onerror
            global.Image = class {
                onload: () => void = () => {};
                onerror: (e: any) => void = () => {};
                set src(_url: string) {
                    setTimeout(() => {
                        if (this.onerror) this.onerror(new Error('Corrupted image'));
                    }, 0);
                }
            } as any;

            const largeData = new Uint8Array(500 * 1024);
            const file = new File([largeData], 'broken.jpg', { type: 'image/jpeg' });

            const result = await compressImage(file);
            expect(result).toBe(file); // Safe fallback without crashing
        });
    });
});
