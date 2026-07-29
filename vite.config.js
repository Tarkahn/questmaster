import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'QuestMaster',
        short_name: 'QuestMaster',
        description: 'Complete tasks. Build streaks. Level up your day.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f1a',
        theme_color: '#7c3aed',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // HTML is deliberately excluded from precaching. index.html and
        // privacy.html carry content that must always reflect the latest
        // deploy (OAuth verification meta tags, landing page copy) — a
        // precached HTML shell is served by an already-installed service
        // worker on a return visit *before* that worker's background update
        // check runs, so a returning visitor (or a crawler that's visited
        // before) can see stale content until they force-refresh. Only
        // content-hashed build assets (js/css) and static images are safe to
        // precache, since their filenames change whenever their content does.
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/accounts\.google\.com\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/tiles\.stadiamaps\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true,
  },
})
