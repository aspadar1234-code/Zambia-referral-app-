import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Zambia Health Referral Pro+',
          short_name: 'ReferPro',
          description: 'Secure, real-time medical referral system for Zambian health facilities. Track emergencies, coordinate facility transfers, and sync data offline.',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'browser'],
          orientation: 'portrait',
          dir: 'ltr',
          lang: 'en-ZM',
          categories: ['medical', 'health', 'government'],
          scope: '/',
          start_url: '/',
          id: 'zambia-referral-pro-v1',
          iarc_rating_id: 'e987b12d-064b-487b-83c3-3e11f189623d',
          note_handler: {
            new_note_url: '/?action=new-note'
          },
          edge_side_panel: {
            preferred_width: 400
          },
          launch_handler: {
            client_mode: ['some-new-future-value', 'focus-existing', 'auto']
          },
          scope_extensions: [
            { origin: '*.pwabuilder.com' },
            { origin: 'docs.pwabuilder.co.uk' },
            { origin: '*.pwabuilder.co.uk' }
          ],
          web_apps: [
            {
              web_app_identity: 'https://docs.pwabuilder.com/'
            }
          ],
          file_handlers: [
            {
              action: '/',
              accept: {
                'application/pdf': ['.pdf']
              },
              icons: [
                {
                  src: 'https://img.icons8.com/color/256/pdf.png',
                  sizes: '256x256',
                  type: 'image/png'
                }
              ],
              launch_type: 'single-client'
            },
            {
              action: '/',
              accept: {
                'application/sla': ['.stl'],
                'application/octet-stream': ['.fbx']
              },
              icons: [
                {
                  src: 'https://img.icons8.com/color/256/3d-printer.png',
                  sizes: '256x256',
                  type: 'image/png'
                }
              ],
              launch_type: 'multiple-clients'
            }
          ],
          shortcuts: [
            {
              name: 'Dashboard',
              short_name: 'Dash',
              description: 'View recent referrals and stats',
              url: '/',
              icons: [
                { 
                  src: 'https://img.icons8.com/color/96/dashboard.png', 
                  sizes: '96x96',
                  type: 'image/png'
                }
              ]
            },
            {
              name: 'New Referral',
              short_name: 'New',
              description: 'Create a new patient referral',
              url: '/',
              icons: [
                { 
                  src: 'https://img.icons8.com/color/96/plus.png', 
                  sizes: '96x96',
                  type: 'image/png'
                }
              ]
            }
          ],
          icons: [
            {
              src: 'https://img.icons8.com/color/144/hospital-sign.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://img.icons8.com/color/192/hospital-sign.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://img.icons8.com/color/512/hospital-sign.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://img.icons8.com/color/512/hospital-sign.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        } as any,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}', 'offline.html'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'firestore-sync-queue',
                  options: {
                    maxRetentionTime: 24 * 60 // Retry for up to 24 hours
                  }
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <--- 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <--- 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/img\.icons8\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'icons8-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // <--- 30 days
                },
              },
            },
            {
              urlPattern: /^https:\/\/unpkg\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'leaflet-assets-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30, 
                },
              },
            }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
