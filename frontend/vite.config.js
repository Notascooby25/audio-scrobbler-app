import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker, the backend is at http://backend:8000 (internal DNS).
// For local dev (no Docker), the default of http://localhost:8000 is used.
// Set BACKEND_PROXY_URL in the environment to override.
const backendUrl = process.env.BACKEND_PROXY_URL || 'http://localhost:8000'

// Vite rejects requests whose Host header isn't recognized (DNS-rebinding
// protection). Set VITE_ALLOWED_HOSTS (comma-separated) to allow a
// reverse-proxied or tunneled hostname, e.g. a Tailscale Funnel domain.
const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim())
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy: {
      '/import': { target: backendUrl, changeOrigin: true },
      '/auth': { target: backendUrl, changeOrigin: true },
      '/analytics': { target: backendUrl, changeOrigin: true },
      '/stats': { target: backendUrl, changeOrigin: true },
      // /library and /reports are also SPA page routes (GET /library, GET
      // /reports) with no bare backend counterpart — only sub-paths like
      // /library/scrobbles or /reports/summary are real API calls. bypass
      // hands the bare route back to Vite's own SPA-fallback middleware
      // instead of proxying it to the backend, where it would 404.
      '/library': {
        target: backendUrl,
        changeOrigin: true,
        bypass: (req) => {
          const path = req.url.split('?')[0]
          if (path === '/library' || path === '/library/') return req.url
        },
      },
      '/reports': {
        target: backendUrl,
        changeOrigin: true,
        bypass: (req) => {
          const path = req.url.split('?')[0]
          if (path === '/reports' || path === '/reports/') return req.url
        },
      },
      '/spotify': { target: backendUrl, changeOrigin: true },
      '/users': { target: backendUrl, changeOrigin: true },
      '/preferences': { target: backendUrl, changeOrigin: true },
      '/blocks': { target: backendUrl, changeOrigin: true },
      '/artwork': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true },
      '/readyz': { target: backendUrl, changeOrigin: true },
      '/tools': { target: backendUrl, changeOrigin: true },
    },
  },
})