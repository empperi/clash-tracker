export const manifestConfig = {
  name: 'Clash Tracker',
  short_name: 'Clash Tracker',
  description: 'Mobile-first PWA for tracking Clash of Clans war participation and planning CWL.',
  theme_color: '#0f0904',
  background_color: '#0f0904',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  // Explicit scope/start_url so link handling applies to the whole app, including /login.
  start_url: '/',
  scope: '/',
  // Opportunistic PWA link handling (Android/ChromeOS; not iOS): supporting browsers open
  // in-scope links — notably the sign-in magic link at /login — in the installed app, and
  // navigate the existing client so LoginView's onMounted path completes the sign-in in-app.
  // The one-time code remains the universal path on platforms that ignore these members.
  handle_links: 'preferred' as const,
  launch_handler: { client_mode: 'navigate-existing' as const },
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
