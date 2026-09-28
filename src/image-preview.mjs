import { decodeHTML, escapeHTML } from './html.mjs';

/** Enhance image-resource links only; article and member links keep their navigation. */
export function prepareImageLinks(markup) {
  return markup.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, attributes, contents) => {
    const href = attributes.match(/\shref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !/<img\b/i.test(contents) || /\sdownload(?:\s|=|$)/i.test(attributes)) return anchor;

    let url;
    try {
      url = new URL(decodeHTML(href), 'https://pkuaimi.github.io');
    } catch {
      return anchor;
    }
    if (!['http:', 'https:'].includes(url.protocol) || !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)) return anchor;

    const rel = attributes.match(/\srel\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
    const tokens = new Set(decodeHTML(rel).split(/\s+/).filter(token => token && token.toLowerCase() !== 'opener'));
    tokens.add('noopener');
    const remaining = attributes
      .replace(/\s(?:target|rel|data-image-preview|aria-haspopup)\b(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
    return `<a${remaining} data-image-preview aria-haspopup="dialog" target="_blank" rel="${escapeHTML([...tokens].join(' '))}">${contents}</a>`;
  });
}
