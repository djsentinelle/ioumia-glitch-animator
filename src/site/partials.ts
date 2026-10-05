// Shared markup for the site pages. vite.config.ts injects it at build time,
// so every page ships the sidebar, top bar and footer as plain HTML.

export type SitePage = 'home' | 'works' | 'merch' | 'factory'

const NAV: { page: SitePage; num: string; label: string; href: string }[] = [
  { page: 'home', num: '01', label: 'home', href: '/' },
  { page: 'works', num: '02', label: 'works', href: '/works/' },
  { page: 'merch', num: '03', label: 'merch', href: '/merch/' },
  { page: 'factory', num: '04', label: 'factory', href: '/factory/' },
]

const PAGE_LABEL: Record<SitePage, string> = {
  home: 'home', works: 'works', merch: 'merch', factory: 'the factory',
}

export function sidebar(page: SitePage): string {
  const chips = NAV.map(n => {
    const active = n.page === page
    return `<a class="nav-chip${active ? ' is-active' : ''}" href="${n.href}"${active ? ' aria-current="page"' : ''}><span class="nav-num">${n.num}</span>${n.label}</a>`
  }).join('\n      ')
  return `<aside class="sidebar">
  <div class="sidebar-inner">
    <a class="profile" href="/">
      <span class="avatar"><img src="/site/avatar.png" alt="ioumia"></span>
      <span class="profile-name">
        <span class="profile-title">ioumia</span>
        <span class="profile-handle">˚₊· @ioumiaa</span>
      </span>
    </a>
    <nav class="nav" aria-label="site">
      ${chips}
    </nav>
  </div>
</aside>`
}

export function topbar(page: SitePage): string {
  return `<header class="topbar">
  <div class="topbar-left"><span class="topbar-name">ioumia</span><span>˚₊·</span><span>${PAGE_LABEL[page]}</span></div>
  <div class="topbar-right">
    <a href="https://instagram.com/ioumiaa" target="_blank" rel="noopener">instagram ↗</a>
    <a class="topbar-bag" href="/merch/">bag · <span data-bag-count>0</span></a>
  </div>
</header>`
}

export function footer(): string {
  return `<footer class="footer">
  <span>© 2026 ioumia</span>
  <span>please credit if you share ˚₊·</span>
</footer>`
}
