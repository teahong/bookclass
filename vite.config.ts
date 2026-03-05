import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vercel 배포 시 경로 문제를 방지하기 위해 루트('/')로 고정합니다.
  base: '/',
  server: {
    proxy: {
      '/api/aladin': {
        target: 'http://www.aladin.co.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/aladin/, ''),
      },
    },
  },
})
