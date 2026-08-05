import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/db.json',
        '**/*.backup',
        '**/backups/**',
        '**/scratch/**'
      ]
    },
    proxy: {
      // Uploaded images are stored and served by the API server, not by Vite.
      // Proxying lets the DB hold portable relative URLs like /api/images/x.jpg.
      '/api/images': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/goldprice': {
        target: 'https://data-asg.goldprice.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/goldprice/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://goldprice.org/');
          });
        }
      }
    }
  }
})
