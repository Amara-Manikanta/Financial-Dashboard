import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
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
