import { prepareImageLinks } from '../image-preview.mjs';

/** Shared navigation, metadata, page framing, footer and dialogs. */
export function createLayout(context) {
  const {
    config,
    pages,
    language,
    assetVersion,
    home,
    t,
    localized,
    pageUrl,
    pageRoute,
    esc,
    arrow,
    searchIcon,
    navItems,
    active,
  } = context;

  function header(current) {
    const otherLanguage = language === 'en' ? 'zh' : 'en';
    const alternateLanguageTag = otherLanguage === 'zh' ? 'zh-CN' : 'en';
    const navigationLinks = navItems.map(([url, key]) => `
      <li><a href="${pageUrl(url)}"${active(url, current) ? ' aria-current="page"' : ''}>${t(key)}</a></li>`)
      .join('');

    return `<a class="skip-link" href="#main">${t('skip')}</a>
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="identity" href="${pageUrl('/')}" aria-label="${t('homeLabel')}">
          <img class="university-emblem" src="/assets/brand/pku-emblem-red.png" alt="${t('university')}" width="360" height="360">
          <span class="identity-copy"><span class="wordmark">AIMI Lab</span>
            <span class="identity-text">${t('university')}</span>
          </span>
        </a>
        <nav class="navigation" aria-label="${t('navLabel')}">
          <ul class="nav-links" id="primary-navigation" data-nav-links>${navigationLinks}</ul>
        </nav>
        <div class="header-actions">
          <a class="language-switch" data-language-switch href="${pageUrl(current, otherLanguage)}" hreflang="${alternateLanguageTag}" lang="${alternateLanguageTag}" aria-label="${t('switchLabel')}">${otherLanguage === 'zh' ? '中文' : 'English'}</a>
          <button class="search-toggle" data-search-open aria-label="${t('searchOpen')}">${searchIcon}</button>
          <button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="primary-navigation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>
            <span data-menu-label class="sr-only">${t('menu')}</span>
          </button>
        </div>
      </div>
    </header>`;
  }

  function footer(homepage = false) {
    const navigationLinks = navItems.slice(1).map(([url, key]) => `
      <li><a href="${pageUrl(url)}">${t(key)}</a></li>`).join('');

    return `<footer class="site-footer${homepage ? ' story-section story-contact' : ''}"${homepage ? ' id="contact" data-story-section' : ''}>
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <a class="footer-brand" href="${pageUrl('/')}">
              <img class="footer-emblem" src="/assets/brand/pku-emblem-white.png" alt="" width="360" height="360" loading="lazy">
              <span>${t('labName')}<small>${t('university')}</small></span>
            </a>
            <p>${t('fullName')}<br>${t('institute')}<br>${t('institution')}</p>
          </div>
          <div>
            <h2>${t('getInTouch')}</h2>
            <p>${t('address')}</p>
            <a class="text-link" href="mailto:${config.email}">${config.email} ${arrow}</a>
          </div>
          <nav aria-label="${t('footerNav')}">
            <h2>${t('explore')}</h2>
            <ul class="footer-links">
              ${navigationLinks}
              <li><a href="${config.github}">GitHub ↗</a></li>
            </ul>
          </nav>
        </div>
        <div class="footer-bottom">
          <a href="https://www.pku.edu.cn/">${t('university')}</a>
          <a href="${config.repository}">${t('websiteSource')} ↗</a>
        </div>
      </div>
    </footer>
    <dialog class="search-dialog" data-search-dialog aria-labelledby="search-title">
      <header>
        <h2 id="search-title">${t('searchTitle')}</h2>
        <button class="close-search" data-search-close aria-label="${t('searchClose')}">×</button>
      </header>
      <div class="search-body">
        <label class="sr-only" for="site-search">${t('searchLabel')}</label>
        <input id="site-search" type="search" placeholder="${t('searchPlaceholder')}" autocomplete="off">
        <p class="search-hint" data-search-status aria-live="polite">${t('searchHint')}</p>
        <ul class="search-results" data-search-results></ul>
      </div>
    </dialog>
    <dialog class="image-preview" data-image-preview-dialog aria-labelledby="image-preview-title">
      <header class="image-preview-toolbar">
        <h2 id="image-preview-title">${t('imagePreview')}</h2>
        <a class="image-preview-original" data-preview-original target="_blank" rel="noopener">${t('imageOriginal')} ↗</a>
        <button type="button" data-preview-close aria-label="${t('imageClose')}" autofocus>×</button>
      </header>
      <div class="image-preview-stage" data-preview-stage>
        <div class="image-preview-media" data-preview-media></div>
        <p class="image-preview-status" data-preview-status role="status"></p>
      </div>
      <footer class="image-preview-footer">
        <p class="image-preview-caption" data-preview-caption></p>
        <div class="image-preview-navigation" data-preview-navigation>
          <button type="button" data-preview-previous aria-label="${t('imagePrevious')}">←</button>
          <span data-preview-counter aria-live="polite" aria-atomic="true"></span>
          <button type="button" data-preview-next aria-label="${t('imageNext')}">→</button>
        </div>
      </footer>
    </dialog>`;
  }

  function layout(title, url, body, description = t('description')) {
    const canonical = config.url + pageUrl(url);
    const pageTitleText = (url === '/' ? '' : title + ' | ') + t('labName') + ' · ' + t('university');
    const messageKeys = [
      'menu',
      'menuClose',
      'scrollableTable',
      'searchHint',
      'searching',
      'searchError',
      'resultSingular',
      'resultPlural',
      'searchEmpty',
      'imageLoading',
      'imageError',
      'imagePosition',
      'pauseSlideshow',
      'playSlideshow',
    ];
    const messages = JSON.stringify(Object.fromEntries(messageKeys.map(key => [key, t(key)])))
      .replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : 'en'}" data-language="${language}" class="no-js">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${esc(pageTitleText)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="theme-color" content="#94070a">
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="en" href="${config.url}${pageUrl(url, 'en')}">
    <link rel="alternate" hreflang="zh-CN" href="${config.url}${pageUrl(url, 'zh')}">
    <link rel="alternate" hreflang="x-default" href="${config.url}${pageUrl(url, 'en')}">
    <meta property="og:title" content="${esc(title + ' · ' + t('labName'))}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:locale" content="${language === 'zh' ? 'zh_CN' : 'en_US'}">
    <meta property="og:image" content="${config.url}${context.localUrl(home.hero[0].display)}">
    <link rel="icon" href="/assets/lab-logo.png" type="image/png">
    <link rel="stylesheet" href="/styles.css?v=${assetVersion}">
    ${url === '/' ? `<link rel="stylesheet" href="/home.css?v=${assetVersion}">
    <link rel="stylesheet" href="/assets/scroll/home-scroll.css?v=${assetVersion}">
    <script type="module" src="/assets/scroll/home-scroll.js?v=${assetVersion}"></script>` : ''}
    <script type="application/json" id="ui-messages">${messages}</script>
    <script src="/site.js?v=${assetVersion}" defer></script>
  </head>
  <body${url === '/' ? ' class="is-home"' : ''}>${header(url)}${prepareImageLinks(body)}${footer(url === '/')}</body>
</html>`;
  }

  function sectionInfo(url) {
    return {
      '/news/': [t('news'), t('newsDescription')],
      '/people/': [t('people'), t('peopleDescription')],
      '/research/': [t('researchTitle'), t('researchDescription')],
      '/publications/': [t('publications'), t('publicationsDescription')],
      '/contact/': [t('contact'), t('institute') + ' · ' + t('institution')],
    }[url];
  }

  function pageTitle(page) {
    return page.path === '/'
      ? t('overview')
      : sectionInfo(pageRoute(page))?.[0] || localized('pages', page.id).title;
  }

  function banner(title, description, profile = false) {
    const profileBreadcrumb = profile
      ? `<a href="${pageUrl('/people/')}">${t('people')}</a><span aria-hidden="true">/</span>`
      : '';

    return `<div class="page-banner">
      <div class="wrap">
        <nav class="breadcrumbs" aria-label="${t('breadcrumb')}">
          <a href="${pageUrl('/')}">${t('labName')}</a>
          <span aria-hidden="true">/</span>
          ${profileBreadcrumb}
          <span aria-current="page">${esc(title)}</span>
        </nav>
        <h1>${esc(title)}</h1>
        ${description ? `<p>${esc(description)}</p>` : ''}
      </div>
    </div>`;
  }

  function aside(current) {
    const profileLinks = pages
      .filter(page => page.type === 'profile')
      .map(page => [pageUrl(pageRoute(page)), localized('pages', page.id).title]);
    const links = [[pageUrl('/people/'), t('allMembers')], ...profileLinks]
      .map(([url, label]) => `
        <a href="${url}"${url === pageUrl(current) ? ' aria-current="page"' : ''}>${esc(label)}<span aria-hidden="true">↗</span></a>`)
      .join('');

    return `<aside class="section-nav" aria-label="${t('people')}">
      <p>${t('people')}</p>
      ${links}
      <p class="aside-note">${t('labName')}<br>${t('institute')}<br>${t('university')}</p>
    </aside>`;
  }

  function pageShell(url, content) {
    const page = pages.find(page => pageRoute(page) === url);
    const profile = page.type === 'profile';
    const [title, description] = sectionInfo(url) || [localized('pages', page.id).title, ''];

    return `<main id="main" class="page-${profile ? 'profile' : url.split('/')[1]}">
      ${banner(title, description, profile)}
      <div class="wrap page-layout${profile ? ' has-sidebar' : ''}">
        ${profile ? aside(url) : ''}
        <div class="${profile ? 'profile-content' : 'page-content'}">${content}</div>
      </div>
    </main>`;
  }

  return { layout, pageTitle, pageShell };
}
