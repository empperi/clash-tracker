export const manifestConfig = {
  name: 'Clash Tracker',
  short_name: 'Clash Tracker',
  description: 'Mobile-first PWA for tracking Clash of Clans war participation and planning CWL.',
  theme_color: '#0f0904',
  background_color: '#0f0904',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  icons: [
    {
      src: 'icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
};
