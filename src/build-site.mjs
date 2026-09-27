import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, LANGUAGES, loadContent } from './content.mjs';
import { plainText } from './html.mjs';
import { localizedPath, outputFile } from './urls.mjs';
import { createContext } from './context.mjs';
import { collectPublicFiles, writeOutput } from './output.mjs';
import { createLayout } from './templates/layout.mjs';
import { renderHome } from './templates/home.mjs';
import { renderNews } from './templates/news.mjs';
import { renderPeople } from './templates/people.mjs';
import { renderResearch } from './templates/research.mjs';
import { renderPublications } from './templates/publications.mjs';
import { renderContact } from './templates/contact.mjs';

const listingTemplates = {
  news: renderNews, people: renderPeople, research: renderResearch,
  publications: renderPublications, contact: renderContact,
};

/** Build every edition in memory before updating published files. */
export function buildSite({ root = ROOT } = {}) {
  const data = loadContent(root);
  const assetVersion = createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'public/styles.css')))
    .update(fs.readFileSync(path.join(root, 'public/site.js')))
    .digest('hex').slice(0, 10);
  const files = new Map();

  for (const language of LANGUAGES) {
    const context = createContext(data, language, assetVersion);
    const { layout, pageTitle, pageShell } = createLayout(context);
    const { t, html, pageUrl, straight } = context;
    const search = [];
    for (const page of data.pages) {
      let content;
      if (page.type === 'home') content = renderHome(context);
      else {
        const body = listingTemplates[page.type]
          ? listingTemplates[page.type](context)
          : `<div class="prose">${html(page[language].html)}</div>`;
        content = pageShell(page.path, body);
      }
      const document = layout(pageTitle(page), page.path, content);
      files.set(outputFile(pageUrl(page.path)), document);
      if (language === 'en') {
        for (const alias of page.aliases || []) files.set(outputFile(alias), document);
      }
      if (!['news', 'publications'].includes(page.type)) {
        search.push({ title: pageTitle(page), url: pageUrl(page.path),
          text: plainText(['profile', 'page'].includes(page.type) ? page[language].html : content) });
      }
    }
    files.set(outputFile(pageUrl('/404.html')), layout(t('notFound'), '/404.html',
      `<main class="not-found" id="main"><p class="eyebrow">${t('labName')}</p><h1>404</h1><p>${t('notFoundText')}</p><a class="button" href="${pageUrl('/')}">${t('backHome')} ${straight}</a></main>`));
    search.push(
      ...data.news.map(item => ({ title: item[language].title, url: `${pageUrl('/news/')}#${item.id}`, text: plainText(item[language].bodyHtml) })),
      ...data.publications.map(item => ({ title: item.citation, url: `${pageUrl('/publications/')}#${item.id}`, text: item.citation })),
    );
    files.set(language === 'zh' ? 'zh/search-index.json' : 'search-index.json', JSON.stringify(search));
  }
  const sitemap = LANGUAGES.flatMap(language => data.pages.map(page =>
    `<url><loc>${data.config.url}${localizedPath(page.path, language)}</loc></url>`)).join('');
  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`);
  files.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${data.config.url}/sitemap.xml\n`);
  files.set('.nojekyll', '');
  collectPublicFiles(root, files);
  writeOutput(root, files);
  return { pages: data.pages.length, news: data.news.length, people: data.people.length, publications: data.publications.length, projects: data.projects.length };
}
