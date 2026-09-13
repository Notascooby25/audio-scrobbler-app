import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/import': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/analytics': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/library': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/spotify': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/preferences': 'http://localhost:8000',
      '/blocks': 'http://localhost:8000',
    },
  },
})