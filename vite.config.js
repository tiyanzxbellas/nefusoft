import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/anime': {
        target: 'https://www.sankavollerei.web.id',
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: 'https://www.sankavollerei.web.id',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  build: {
    target: 'esnext',
    cssMinify: true,
    minify: 'oxc',
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: true,
          }
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
