import path from 'node:path';
import { decodeHTML, normalizedPath } from './html.mjs';

export function localizedPath(route, language) {
  return language === 'zh' ? `/zh${route}` : route;
}

export function outputFile(route) {
  return route.endsWith('.html')
    ? route.replace(/^\//, '')
    : path.join(decodeURIComponent(route).replace(/^\//, ''), 'index.html');
}

/** Preserve migrated aliases, while keeping every content link in its language. */
export function createURLResolver(data, language) {
  const routes = new Map();
  for (const page of data.pages) {
    for (const route of [page.path, ...(page.aliases || [])]) {
      routes.set(normalizedPath(route), page.path);
    }
  }
  const mediaByPath = mediaMap => new Map(Object.entries(mediaMap).flatMap(([source, target]) => {
    try {
      const pathname = new URL(decodeHTML(source)).pathname.replace(/^\/pkuaimi\.com/, '');
      return [[normalizedPath(pathname), typeof target === 'string' ? target : target.path || target.displayPath]];
    } catch {
      return [];
    }
  }));
  const originals = mediaByPath(data.media);
  const displays = mediaByPath(data.displayMedia);
  const hosts = new Set(['pkuaimi.com', 'www.pkuaimi.com', 'i0.wp.com', 'i1.wp.com', 'i2.wp.com', new URL(data.config.url).hostname]);

  return function localURL(value, display = false) {
    const raw = decodeHTML(value);
    if (raw.startsWith('#') || raw.startsWith('/assets/')) return raw;
    let url;
    try {
      url = new URL(raw, 'https://pkuaimi.com');
    } catch {
      return raw;
    }
    if (!hosts.has(url.hostname)) return raw;
    const pathname = normalizedPath(url.pathname.replace(/^\/pkuaimi\.com/, ''));
    const asset = (display && displays.get(pathname)) || data.media[raw] || originals.get(pathname);
    if (asset) return asset;
    if (url.searchParams.has('page_id')) {
      const page = data.pages.find(item => String(item.id) === url.searchParams.get('page_id'));
      if (page) return localizedPath(page.path, language) + url.hash;
    }
    const route = routes.get(pathname.replace(/^\/zh(?=\/)/, ''));
    if (route) return localizedPath(route, language) + url.search + url.hash;
    return raw;
  };
}
