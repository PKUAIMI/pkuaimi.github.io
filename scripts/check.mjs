import fs from 'node:fs';
import path from 'node:path';
import { loadContent, ROOT } from '../src/content.mjs';

// Validate the delivered HTML against its editable content, without a browser,
// network access, third-party packages, or assumptions about source file order.
const root = ROOT;
const dist = path.join(root, 'dist');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const errors = [];
let checks = 0;
const check = (condition, message) => { checks++; if (!condition) errors.push(message); };
const decode = value => String(value).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
  const point = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
  return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
}).replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|hellip);/g, (_, name) => ({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…'
})[name]);
const unquote = value => { try { return decodeURIComponent(value); } catch { return value; } };
const normalized = value => decode(value).replace(/\s+/g, '');
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const attributes = source => Object.fromEntries([...source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4] ?? '')]));
function parseHTML(source) {
  const document = { tag: '#document', attrs: {}, children: [] };
  const stack = [document], elements = [], ids = new Map();
  const tokens = source.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+|</g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!')) continue;
    const end = token.match(/^<\/\s*([\w:-]+)/);
    if (end) {
      const index = stack.findLastIndex(node => node.tag === end[1].toLowerCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const start = token.match(/^<([\w:-]+)\b([\s\S]*?)\/?\s*>$/);
    if (start) {
      const node = { tag: start[1].toLowerCase(), attrs: attributes(start[2]), children: [], parent: stack.at(-1) };
      node.parent.children.push(node); elements.push(node);
      if (node.attrs.id) {
        const entries = ids.get(node.attrs.id) || []; entries.push(node); ids.set(node.attrs.id, entries);
      }
      if (!voidTags.has(node.tag) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push(decode(token));
  }
  return { document, elements, ids };
}
function text(node) {
  if (typeof node === 'string') return node;
  if (['script', 'style'].includes(node.tag)) return '';
  return node.children.map(text).join('');
}
const textHTML = html => text(parseHTML(html).document);
const descendants = node => !node || typeof node === 'string' ? [] : [node, ...node.children.flatMap(descendants)];
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const walkFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);

if (!fs.existsSync(dist)) {
  console.error('Missing dist/. Run npm run build before npm run check.');
  process.exit(1);
}
const { config, ui, pages, news, people, publications, projects, home, media, displayMedia: display } = loadContent(root);
const site = new URL(config.url);
const locales = [{ key: 'en', htmlLang: 'en', prefix: '' }, { key: 'zh', htmlLang: 'zh-CN', prefix: '/zh' }];
const localizedPath = (route, locale) => locale.prefix + route;
const basePath = route => route.startsWith('/zh/') ? route.slice(3) : route;
const translated = (name, item, locale) => item[locale.key] || {};
const sourceProfiles = pages.filter(page => ['profile', 'page'].includes(page.type));
const routeForType = type => pages.find(page => page.type === type).path;
const pageLabel = page => page.en?.title || page.path;
for (const [name, records, fields] of [
  ['news', news, ['title', 'bodyHtml']],
  ['research', projects, ['title', 'descriptionHtml']],
  ['people', people, ['name']],
  ['pages', pages.filter(page => page.path === '/' || sourceProfiles.includes(page)), ['title', 'html']]
]) {
  for (const item of records) for (const locale of locales) {
    const entry = translated(name, item, locale);
    for (const field of fields) {
      // Three imported research projects contain only a title and figure. An
      // explicit empty description preserves that source without inventing prose.
      const mayBeEmpty = field === 'descriptionHtml';
      check(typeof entry[field] === 'string' && (mayBeEmpty || entry[field].trim().length > 0), `${name} ${item.id}: missing ${locale.key}.${field} localization`);
    }
  }
}
const inventory = readJSON('content/migration-inventory.json');
const manifest = readJSON('content/media-manifest.json');
const fullSizeForDisplay = new Map();
for (const [source, target] of Object.entries(display)) {
  const displayPath = typeof target === 'string' ? target : target.path || target.displayPath;
  if (media[source]) {
    const originals = fullSizeForDisplay.get(displayPath) || new Set();
    originals.add(media[source]); fullSizeForDisplay.set(displayPath, originals);
  }
}
const documents = new Map();
for (const file of walkFiles(dist).filter(file => file.endsWith('.html'))) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  documents.set(relative, { ...parseHTML(fs.readFileSync(file, 'utf8')), file, relative });
}
function fileForPath(urlPath) {
  const decoded = unquote(urlPath).replace(/^\/+/, '');
  const candidate = path.resolve(dist, decoded);
  if (candidate !== dist && !candidate.startsWith(dist + path.sep)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, 'index.html');
  return fs.existsSync(index) && fs.statSync(index).isFile() ? index : null;
}
function documentForPath(urlPath) {
  const file = fileForPath(urlPath);
  return file && documents.get(path.relative(dist, file).split(path.sep).join('/'));
}
function sourceUrlFor(document) {
  const urlPath = document.relative.endsWith('index.html') ? document.relative.slice(0, -10) : document.relative;
  return new URL('/' + urlPath, site);
}
function validateURL(value, source, label, { image = false } = {}) {
  if (!value) { check(false, `${label}: empty URL`); return; }
  if (value === '#') { check(false, `${label}: placeholder link #`); return; }
  if (/^(?:mailto|tel):/i.test(value)) return;
  if (/^(?:javascript|data|vbscript):/i.test(value)) { check(false, `${label}: unsupported URL scheme`); return; }
  let url;
  try { url = new URL(value, source); } catch { check(false, `${label}: invalid URL ${value}`); return; }
  const oldHost = /^(?:www\.)?pkuaimi\.com$/.test(url.hostname) || (/^i[0-9]\.wp\.com$/.test(url.hostname) && url.pathname.startsWith('/pkuaimi.com/'));
  check(!oldHost, `${label}: still depends on old site: ${value}`);
  if (url.origin !== site.origin) {
    if (image) check(false, `${label}: external image was not archived: ${value}`);
    return;
  }
  const target = fileForPath(url.pathname);
  check(!!target, `${label}: missing local target ${url.pathname}`);
  if (target && url.hash) {
    const doc = documentForPath(url.pathname);
    const anchor = unquote(url.hash.slice(1));
    if (doc) check(doc.ids.has(anchor) || doc.elements.some(n => n.tag === 'a' && n.attrs.name === anchor), `${label}: missing anchor ${url.pathname}#${anchor}`);
  }
}
function canonical(document) {
  const links = document.elements.filter(n => n.tag === 'link' && n.attrs.rel === 'canonical');
  check(links.length === 1, `${document.relative}: expected one canonical URL`);
  if (!links[0]) return null;
  const url = new URL(links[0].attrs.href, site);
  check(url.origin === site.origin, `${document.relative}: wrong canonical host ${url.origin}`);
  return url.pathname;
}
function assertContent(node, expected, label) {
  check(!!node, `${label}: missing rendered element`);
  if (node) check(normalized(text(node)).includes(normalized(expected)), `${label}: original text is missing or changed`);
}
function assertImage(node, imageURL, label) {
  const target = imageURL.startsWith('/assets/') ? imageURL : display[imageURL] || media[imageURL];
  const imagePath = typeof target === 'object' ? target.path || target.displayPath : target;
  check(!!imagePath, `${label}: no media mapping for ${imageURL}`);
  if (node && imagePath) check(descendants(node).some(n => n.tag === 'img' && n.attrs.src === imagePath), `${label}: missing expected image ${imagePath}`);
}
function recordNode(document, record, label) {
  const nodes = document?.ids.get(record.id) || [];
  check(nodes.length === 1, `${label}: expected exactly one #${record.id}, found ${nodes.length}`);
  return nodes[0];
}

for (const document of documents.values()) {
  const location = sourceUrlFor(document);
  const titles = document.elements.filter(n => n.tag === 'title');
  check(titles.length === 1 && text(titles[0]).trim().length > 0, `${document.relative}: expected one nonempty title`);
  check(document.elements.filter(n => n.tag === 'h1').length === 1, `${document.relative}: expected exactly one h1`);
  check(document.elements.filter(n => n.tag === 'main').length === 1, `${document.relative}: expected one main landmark`);
  check(document.ids.has('main'), `${document.relative}: missing #main skip-link target`);
  const route = canonical(document);
  const locale = document.relative.startsWith('zh/') ? locales[1] : locales[0];
  const otherLocale = locales.find(item => item.key !== locale.key);
  const htmlElement = document.elements.find(node => node.tag === 'html');
  check(htmlElement?.attrs.lang === locale.htmlLang, `${document.relative}: expected html lang=${locale.htmlLang}`);
  const descriptions = document.elements.filter(node => node.tag === 'meta' && node.attrs.name === 'description');
  check(descriptions.length === 1 && descriptions[0].attrs.content?.trim().length > 0, `${document.relative}: expected one nonempty description`);
  if (route) {
    check(route.startsWith('/zh/') === (locale.key === 'zh'), `${document.relative}: canonical URL has the wrong locale`);
    const cleanRoute = basePath(route);
    const switches = document.elements.filter(node => node.tag === 'a' && 'data-language-switch' in node.attrs);
    check(switches.length === 1, `${document.relative}: expected one language switch`);
    if (switches[0]) check(new URL(switches[0].attrs.href, site).pathname === localizedPath(cleanRoute, otherLocale), `${document.relative}: language switch does not target the same page in ${otherLocale.key}`);
    const alternates = document.elements.filter(node => node.tag === 'link' && node.attrs.rel === 'alternate' && node.attrs.hreflang);
    check(alternates.length === 3, `${document.relative}: expected en, zh-CN and x-default alternate URLs`);
    for (const [language, alternateRoute] of [['en', cleanRoute], ['zh-CN', localizedPath(cleanRoute, locales[1])], ['x-default', cleanRoute]]) {
      const matches = alternates.filter(node => node.attrs.hreflang === language);
      check(matches.length === 1 && matches[0].attrs.href === new URL(alternateRoute, site).href, `${document.relative}: incorrect ${language} alternate URL`);
    }
    const openGraphURL = document.elements.filter(node => node.tag === 'meta' && node.attrs.property === 'og:url');
    check(openGraphURL.length === 1 && openGraphURL[0].attrs.content === new URL(route, site).href, `${document.relative}: Open Graph URL differs from canonical URL`);
  }
  const main = document.elements.find(node => node.tag === 'main');
  if (locale.key === 'en' && main) check(!/[\u3400-\u9fff]/u.test(text(main)), `${document.relative}: English main content still contains untranslated Chinese text`);
  for (const [id, entries] of document.ids) check(entries.length === 1, `${document.relative}: duplicate id ${id}`);
  for (const node of document.elements) {
    for (const attribute of ['href', 'src', 'poster']) {
      if (attribute in node.attrs) validateURL(node.attrs[attribute], location, `${document.relative} <${node.tag}> ${attribute}`, { image: node.tag === 'img' && attribute === 'src' });
    }
    if (node.tag === 'a' && node.attrs.href && !('data-language-switch' in node.attrs)) {
      try {
        const target = new URL(node.attrs.href, location);
        if (target.origin === site.origin && documentForPath(target.pathname)) check(target.pathname.startsWith('/zh/') === (locale.key === 'zh'), `${document.relative}: navigation changes language unexpectedly: ${node.attrs.href}`);
      } catch { /* Invalid URLs are reported by validateURL above. */ }
    }
    if (node.tag === 'img') {
      check('alt' in node.attrs, `${document.relative}: image missing alt attribute`);
      let ancestor = node.parent;
      while (ancestor && ancestor.tag !== 'a') ancestor = ancestor.parent;
      const href = ancestor?.attrs.href;
      if (href?.startsWith('/assets/') && fullSizeForDisplay.has(node.attrs.src)) {
        check(fullSizeForDisplay.get(node.attrs.src).has(href), `${document.relative}: image ${node.attrs.src} opens a different photo ${href}`);
      }
    }
    if (node.attrs.srcset) {
      for (const candidate of node.attrs.srcset.split(',')) validateURL(candidate.trim().split(/\s+/)[0], location, `${document.relative} srcset`, { image: true });
    }
    for (const attribute of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      for (const id of (node.attrs[attribute] || '').split(/\s+/).filter(Boolean)) check(document.ids.has(id), `${document.relative}: ${attribute} points to missing #${id}`);
    }
    if (node.tag === 'label' && node.attrs.for) check(document.ids.has(node.attrs.for), `${document.relative}: label points to missing #${node.attrs.for}`);
  }
  check(!/\b(?:TODO|FIXME|Lorem ipsum)\b/i.test(text(document.document)), `${document.relative}: unfinished placeholder text`);
}

check(pages.length >= inventory.pages.length, 'Editable pages contain fewer pages than the initial migration; original migrated pages must remain available.');
check(inventory.missingSitemapUrls.length === 0, 'Migration inventory has missing sitemap URLs.');
const canonicalPages = new Set();
const pageRoutes = new Map();
const expectedDocuments = new Set(['404.html', 'zh/404.html']);
const relativeForRoute = route => unquote(route).replace(/^\/+/, '') + (route.endsWith('/') ? 'index.html' : '');
for (const page of pages) {
  const route = page.path;
  const original = documentForPath(route);
  check(!!original, `Source page ${pageLabel(page)}: canonical pathname ${route} is missing`);
  pageRoutes.set(page.id, route);
  expectedDocuments.add(relativeForRoute(route));
  for (const alias of page.aliases || []) {
    expectedDocuments.add(relativeForRoute(alias));
    const aliasDocument = documentForPath(alias);
    check(!!aliasDocument, `Source page ${pageLabel(page)}: legacy pathname ${alias} is missing`);
    if (aliasDocument) {
      check(canonical(aliasDocument) === route, `Legacy pathname ${alias}: canonical should be ${route}`);
      check(aliasDocument.elements.find(node => node.tag === 'html')?.attrs.lang === 'en', `Legacy pathname ${alias}: should use the default English language`);
      if (original) check(fs.readFileSync(aliasDocument.file).equals(fs.readFileSync(original.file)), `Legacy pathname ${alias}: content differs from canonical page ${route}`);
    }
  }
  // Listing media is checked per record below; prose images are checked against
  // each language's editable HTML, and homepage artwork has its own settings.
  const structuredListing = ['news', 'people', 'publications', 'research'].includes(page.type);
  for (const locale of locales) {
    const translatedRoute = localizedPath(route, locale);
    canonicalPages.add(translatedRoute);
    expectedDocuments.add(relativeForRoute(translatedRoute));
    const document = documentForPath(translatedRoute);
    check(!!document, `Source page ${pageLabel(page)}: ${locale.key} canonical route ${translatedRoute} is missing`);
    if (!document) continue;
    check(canonical(document) === translatedRoute, `${translatedRoute}: canonical points to a different page`);
    if (!structuredListing) {
      const entry = translated('pages', page, locale);
      const currentSource = parseHTML(entry.html || '');
      for (const image of currentSource.elements.filter(node => node.tag === 'img' && node.attrs.src)) assertImage(document.document, image.attrs.src, `${locale.key} source page ${pageLabel(page)}`);
      if (sourceProfiles.includes(page)) assertContent(document.document, textHTML(entry.html || ''), `${locale.key} content page ${pageLabel(page)}`);
      if (page.type === 'home') {
        assertContent(document.document, textHTML(entry.html || ''), `${locale.key} homepage introduction`);
        assertImage(document.document, home.hero.display, `${locale.key} homepage hero`);
        check(document.elements.some(node => node.tag === 'a' && node.attrs.href === home.hero.original && descendants(node).some(image => image.tag === 'img' && image.attrs.src === home.hero.display)), `${locale.key} homepage: hero should open its original image`);
        for (const image of home.gallery) assertImage(document.document, image.url, `${locale.key} homepage gallery`);
      }
    }
  }
}
check(canonicalPages.size === pages.length * locales.length, 'Two source pages resolve to the same canonical page.');
check(documents.size === expectedDocuments.size, `Expected ${expectedDocuments.size} HTML files across both languages and legacy paths, found ${documents.size}.`);
for (const relative of expectedDocuments) check(documents.has(relative), `Missing generated page ${relative}`);
for (const source of inventory.pages) check(pages.some(page => page.id === source.id && [page.path, ...(page.aliases || [])].some(route => unquote(route) === unquote(source.path))), `Migration inventory page ${source.id} / ${source.title}: original page or path has been dropped.`);

for (const [records, label] of [[news, 'news'], [people, 'people'], [publications, 'publications'], [projects, 'research']]) check(new Set(records.map(record => record.id)).size === records.length, `${label}: duplicate content record ids`);
for (const locale of locales) {
  const newsDocument = documentForPath(localizedPath(routeForType('news'), locale));
  const peopleDocument = documentForPath(localizedPath(routeForType('people'), locale));
  const publicationDocument = documentForPath(localizedPath(routeForType('publications'), locale));
  const researchDocument = documentForPath(localizedPath(routeForType('research'), locale));
  for (const [records, doc, className, label] of [[news, newsDocument, 'news-entry', 'news'], [people, peopleDocument, 'person-card', 'people'], [publications, publicationDocument, 'publication-item', 'publications'], [projects, researchDocument, 'project-entry', 'research']]) {
    check(!!doc, `Missing ${locale.key} ${label} listing page`);
    if (doc) check(doc.elements.filter(node => hasClass(node, className)).length === records.length, `${locale.key} ${label}: rendered count differs from ${records.length} editable records`);
  }
  for (const item of news) {
    const entry = translated('news', item, locale);
    const node = recordNode(newsDocument, item, `${locale.key} news ${item.id}`);
    assertContent(node, entry.title || '', `${locale.key} news ${item.id} title`);
    assertContent(node, textHTML(entry.bodyHtml || ''), `${locale.key} news ${item.id} body`);
    for (const image of item.images || []) assertImage(node, image.url, `${locale.key} news ${item.id}`);
  }
  for (const person of people) {
    const entry = translated('people', person, locale);
    const node = recordNode(peopleDocument, person, `${locale.key} person ${person.en.name}`);
    assertContent(node, entry.name || '', `${locale.key} person ${person.en.name}`);
    assertImage(node, person.image, `${locale.key} person ${person.en.name}`);
    if (person.profilePath && node) {
      const original = documentForPath(person.profilePath);
      check(!!original, `Person ${person.en.name}: missing original profile path`);
      if (original) check(node.attrs.href === localizedPath(canonical(original), locale), `${locale.key} person ${person.en.name}: profile card links to the wrong person or language`);
    }
  }
  for (const publication of publications) {
    const node = recordNode(publicationDocument, publication, `${locale.key} publication ${publication.id}`);
    // Official publication citations stay unchanged in both localized interfaces.
    assertContent(node, publication.citation, `${locale.key} publication ${publication.id}`);
    for (const link of publication.links || []) check(descendants(node).some(n => n.tag === 'a' && n.attrs.href === link.url), `${locale.key} publication ${publication.id}: missing citation link ${link.url}`);
  }
  for (const project of projects) {
    const entry = translated('research', project, locale);
    const node = recordNode(researchDocument, project, `${locale.key} research ${project.id}`);
    assertContent(node, entry.title || '', `${locale.key} research ${project.id} title`);
    assertContent(node, textHTML(entry.descriptionHtml || ''), `${locale.key} research ${project.id} description`);
    for (const image of project.images || []) assertImage(node, image.url, `${locale.key} research ${project.id}`);
  }
  const contact = documentForPath(localizedPath(routeForType('contact'), locale));
  if (contact) {
    assertContent(contact.document, ui[locale.key].address, `${locale.key} contact address`);
    const address = contact.elements.find(node => node.tag === 'address');
    check(!!address && text(address).trim().length > 0, `${locale.key} contact page: missing address`);
    check(contact.elements.some(n => n.tag === 'a' && n.attrs.href === 'mailto:' + config.email), `${locale.key} contact page is missing the email action.`);
  }
}

for (const item of manifest) {
  check(!!media[item.url], `Media manifest: missing archival mapping ${item.url}`);
  if (media[item.url]) {
    const file = fileForPath(media[item.url]);
    check(!!file && fs.statSync(file).size > 0, `Media manifest: original asset missing or empty ${media[item.url]}`);
  }
}
for (const locale of locales) {
  const searchFile = `dist${locale.prefix}/search-index.json`;
  check(fs.existsSync(path.join(root, searchFile)), `Missing ${locale.key} search index`);
  if (!fs.existsSync(path.join(root, searchFile))) continue;
  const search = readJSON(searchFile);
  check(new Set(search.map(record => record.url)).size === search.length, `${locale.key} search index: duplicate result URLs`);
  for (const record of search) {
    validateURL(record.url, site, `${locale.key} search result ${record.title}`);
    check(record.url.startsWith('/zh/') === (locale.key === 'zh'), `${locale.key} search result ${record.title}: wrong language URL`);
    check(typeof record.title === 'string' && record.title.trim().length > 0 && typeof record.text === 'string' && record.text.trim().length > 0, `${locale.key} search result ${record.url}: missing title or text`);
  }
  for (const item of news) {
    const entry = translated('news', item, locale);
    const record = search.find(record => record.url === localizedPath(routeForType('news') + '#' + item.id, locale));
    check(!!record, `${locale.key} news ${item.id}: missing from search index`);
    if (record) {
      check(normalized(record.title) === normalized(entry.title || ''), `${locale.key} news ${item.id}: search title is out of sync with its localized title`);
      check(normalized(record.text) === normalized(textHTML(entry.bodyHtml || '')), `${locale.key} news ${item.id}: search text is out of sync with its localized bodyHtml`);
    }
  }
  for (const item of publications) {
    const record = search.find(record => record.url === localizedPath(routeForType('publications') + '#' + item.id, locale));
    check(!!record, `${locale.key} publication ${item.id}: missing from search index`);
    if (record) check(normalized(record.text).includes(normalized(item.citation)), `${locale.key} publication ${item.id}: search text is missing the original citation`);
  }
  for (const page of pages) {
    const route = pageRoutes.get(page.id);
    if (!route || ['news', 'publications'].includes(page.type)) continue;
    const translatedRoute = localizedPath(route, locale);
    const record = search.find(record => record.url === translatedRoute);
    check(!!record, `${locale.key} page ${translatedRoute}: missing from search index`);
    if (!record) continue;
    const document = documentForPath(translatedRoute);
    const entry = translated('pages', page, locale);
    if (sourceProfiles.includes(page)) check(normalized(record.text).includes(normalized(textHTML(entry.html || ''))), `${locale.key} profile ${pageLabel(page)}: localized content missing from search index`);
    if (page.type === 'home') check(normalized(record.text).includes(normalized(textHTML(entry.html || ''))), `${locale.key} homepage: localized introduction missing from search index`);
    if (page.type === 'contact') {
      const address = document?.elements.find(node => node.tag === 'address');
      if (address) check(normalized(record.text).includes(normalized(text(address))), `${locale.key} contact: address missing from search index`);
      check(record.text.includes(config.email), `${locale.key} contact: email missing from search index`);
    }
    if (page.type === 'people') for (const person of people) check(normalized(record.text).includes(normalized(translated('people', person, locale).name || '')), `${locale.key} person ${person.id}: missing from people search text`);
    if (page.type === 'research') for (const project of projects) check(normalized(record.text).includes(normalized(textHTML(translated('research', project, locale).descriptionHtml || ''))), `${locale.key} research ${project.id}: missing from research search text`);
  }
}
const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
check(sitemapURLs.length === canonicalPages.size, 'Sitemap page count differs from canonical content page count.');
for (const route of canonicalPages) check(sitemapURLs.includes(new URL(route, site).href), `Canonical page ${route} is missing from sitemap.`);
for (const url of sitemapURLs) validateURL(url, site, 'Sitemap');
check(fs.existsSync(path.join(dist, '.nojekyll')), 'GitHub Pages .nojekyll file is missing.');
check(!fs.existsSync(path.join(dist, 'CNAME')), 'Unexpected CNAME: this migration targets pkuaimi.github.io only.');

if (errors.length) {
  console.error(`Website validation failed: ${errors.length} problem(s) across ${checks} checks.`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Passed ${checks} checks across ${documents.size} HTML files, including all ${pages.length} source pages and legacy paths.`);
  console.log(`Verified ${news.length} news items, ${people.length} people, ${publications.length} publications, ${projects.length} projects, and ${manifest.length} archived media assets.`);
  console.log('Localized content, language navigation, links, anchors, image coverage, search, metadata and sitemap are valid.');
}
