import { defineConfig, type Plugin } from 'vite'
import { sidebar, topbar, footer, type SitePage } from './src/site/partials'

// Fills the <!-- @sidebar -->, <!-- @topbar --> and <!-- @footer --> markers
// in site pages. The page comes from <body data-page="…">.
function sitePartials(): Plugin {
  return {
    name: 'site-partials',
    transformIndexHtml(html) {
      const page = html.match(/<body[^>]*data-page="(\w+)"/)?.[1] as SitePage | undefined
      if (!page) return html
      return html
        .replace('<!-- @sidebar -->', sidebar(page))
        .replace('<!-- @topbar -->', topbar(page))
        .replace('<!-- @footer -->', footer())
    },
  }
}

export default defineConfig({
  plugins: [sitePartials()],
  server: { port: 3000 },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        home: 'index.html',
        works: 'works/index.html',
        merch: 'merch/index.html',
        factory: 'factory/index.html',
        glitch: 'factory/glitch/index.html',
        frequency: 'factory/frequency/index.html',
      },
    },
  },
})
