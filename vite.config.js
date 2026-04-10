import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'fs'
import { readFileSync } from 'fs'

// https://vite.dev/config/
// Note: basicSsl was removed. Browsers block service worker registration over self-signed HTTPS.
// http://localhost is already a secure context — service workers and Push API work without HTTPS in dev.

// In WSL2, the .NET backend runs on Windows. Windows is reachable via the default gateway IP,
// NOT via localhost (which resolves to the WSL2 VM). Reads /proc/net/route (Linux-only) to find
// the gateway. Falls back to 'localhost' on native Windows or CI.
function getBackendHost() {
  try {
    const routes = readFileSync('/proc/net/route', 'utf8')
    for (const line of routes.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts[1] === '00000000') { // default route
        const hex = parts[2]         // gateway in little-endian hex
        return [
          parseInt(hex.slice(6, 8), 16),
          parseInt(hex.slice(4, 6), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(0, 2), 16),
        ].join('.')
      }
    }
  } catch {}
  return 'localhost'
}
const backendHost = getBackendHost()
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
        type: 'module', // Required: sw.js uses ES module imports (workbox); without this the browser loads it as a classic script and fails
      },
      manifest: {
        name: 'FlyerBox',
        short_name: 'FlyerBox',
        description: 'FlyerBox – Flyer & Review Management',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    {
      name: 'copy-static-web-app-config',
      closeBundle() {
        copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json')
      }
    }
  ],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    proxy: {
      // Proxy API requests to backend (avoids mixed content errors)
      '/api': {
        target: `https://${backendHost}:5002`,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Proxy image uploads (wwwroot folder)
      '/uploads': {
        target: `https://${backendHost}:5002`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
