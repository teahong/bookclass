import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vercel 배포 시 경로 문제를 방지하기 위해 루트('/')로 고정합니다.
  base: '/',
  server: {
    proxy: {
      '/api/aladin': {
        target: 'https://www.aladin.co.kr',
        changeOrigin: true,
        rewrite: () => '/ttb/api/ItemSearch.aspx',
      },
    },
  },
})
