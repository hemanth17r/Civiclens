import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CivicLens — Report & Track Civic Issues in Your City',
    short_name: 'CivicLens',
    description:
      'Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable — all in one platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb', // CivicLens brand blue
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
