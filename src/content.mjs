import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHTML, plainText } from './html.mjs';
import { validateContent } from './content-validation.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LANGUAGES = ['en', 'zh'];

export function readJSON(root, file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    throw new Error(`${file}: 无法读取 JSON。请检查文件、逗号和双引号。\n${error.message}`);
  }
}

/** Load all authoring files once. Rendering never mutates these records. */
export function loadContent(root = ROOT) {
  const read = file => readJSON(root, file);
  const data = {
    config: read('site.config.json'),
    pages: read('content/pages.json'),
    news: read('content/news.json'),
    people: read('content/people.json'),
    projects: read('content/research.json'),
    groups: read('content/groups.json'),
    home: read('content/home.json'),
    ui: read('content/ui.json'),
    media: read('content/media-map.json'),
    displayMedia: read('content/media-display-map.json'),
    provenance: read('content/media-provenance.json'),
    publications: read('content/publications.json'),
  };

  // A publication is edited once, in html. Search text and links are derived.
  if (Array.isArray(data.publications)) {
    data.publications = data.publications.map(publication => ({
      ...publication,
      citation: typeof publication.html === 'string'
        ? plainText(publication.html.replace(/<\/?(?:b|strong|em|i|span|sup|sub)\b[^>]*>/gi, '')) : '',
      links: typeof publication.html === 'string'
        ? [...publication.html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .map(([, url, text]) => ({ url: decodeHTML(url), text: plainText(text) }))
        : [],
    }));
  }

  const errors = validateContent(data, { root });
  if (errors.length) {
    throw new Error(`内容检查发现 ${errors.length} 个问题：\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
  return data;
}
