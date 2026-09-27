import { escapeHTML, decodeHTML, plainText } from './html.mjs';
import { createURLResolver, localizedPath } from './urls.mjs';

export const navigation = [
  ['/', 'overview'], ['/news/', 'news'], ['/people/', 'people'],
  ['/research/', 'research'], ['/publications/', 'publications'], ['/contact/', 'contact'],
];
export const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
export const straight = '<span class="arrow" aria-hidden="true">→</span>';
export const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';

/** A separate, immutable locale context avoids mutable global language state. */
export function createContext(data, language, assetVersion) {
  const messages = { ...data.ui[language] };
  const t = key => {
    if (typeof messages[key] !== 'string') throw new Error(`content/ui.json: 缺少 ${language}.${key}`);
    return messages[key];
  };
  const collections = { pages: data.pages, news: data.news, people: data.people, research: data.projects };
  const localized = (kind, id) => {
    const record = collections[kind].find(item => String(item.id) === String(id));
    if (!record?.[language]) throw new Error(`content/${kind}.json: ${id} 缺少 ${language} 内容`);
    return record[language];
  };
  const localUrl = createURLResolver(data, language);
  const imageSizes = new Map([...data.provenance.assets, ...data.provenance.displayVariants].map(image => [image.path, image]));
  const dimensions = file => {
    const size = imageSizes.get(file);
    return size?.width && size?.height ? ` width="${size.width}" height="${size.height}"` : '';
  };
  const contentLang = value => /^[\u3400-\u9fff]/.test(plainText(value).replace(/^[^a-z\u3400-\u9fff]+/i, '')) ? ' lang="zh-CN"' : '';
  const html = source => String(source || '')
    .replace(/\b(href|src)\s*=\s*(["'])(.*?)\2/g, (_, attribute, quote, url) => `${attribute}="${escapeHTML(localUrl(url, attribute === 'src'))}"`)
    .replace(/<img\b([^>]*?)>/g, (tag, attributes) => /\bwidth=/.test(attributes) ? tag : `<img${attributes}${dimensions(decodeHTML(attributes.match(/src="([^"]*)"/)?.[1] || ''))}>`)
    .replace(/<h6>([\s\S]*?)<\/h6>/g, (_, content) => plainText(content).length > 100 ? `<p>${content}</p>` : `<h3>${content}</h3>`)
    .replace(/<(p|h[1-6])>([\s\S]*?)<\/\1>/g, (_, tag, body) => `<${tag}${contentLang(body)}>${body}</${tag}>`);
  const picture = (source, alt = '', extra = '') => `<img src="${escapeHTML(localUrl(source, true))}" alt="${escapeHTML(alt)}" loading="lazy" decoding="async"${dimensions(localUrl(source, true))} ${extra}>`;
  const figure = (source, alt = '', extra = '') => `<figure><a href="${escapeHTML(localUrl(source))}" aria-label="${escapeHTML(t('fullImage') + alt)}">${picture(source, alt, extra)}</a></figure>`;
  const current = records => records.map(record => ({ ...record, ...record[language] }));

  return {
    ...data, language, assetVersion, t, localized, html, localUrl, picture, figure,
    esc: escapeHTML, plain: plainText, arrow, straight, searchIcon,
    navItems: navigation,
    active: (route, currentRoute) => route === '/' ? currentRoute === '/' : currentRoute.startsWith(route),
    pageUrl: (route, locale = language) => localizedPath(route, locale),
    pageRoute: page => page.path,
    currentNews: () => current(data.news),
    currentProjects: () => current(data.projects),
    currentPeople: () => current(data.people),
    groupLabel: id => data.groups.find(group => group.id === id)[language],
  };
}
