import { defineConfig } from 'vite'
export default defineConfig({
  server: { port: 3000 },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        frequency: 'frequency-background-animator/index.html',
      },
    },
  },
})
