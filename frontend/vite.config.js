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
      '/library': { target: backendUrl, changeOrigin: true },
      '/reports': { target: backendUrl, changeOrigin: true },
      '/spotify': { target: backendUrl, changeOrigin: true },
      '/users': { target: backendUrl, changeOrigin: true },
      '/preferences': { target: backendUrl, changeOrigin: true },
      '/blocks': { target: backendUrl, changeOrigin: true },
      '/artwork': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true },
      '/readyz': { target: backendUrl, changeOrigin: true },
    },
  },
})