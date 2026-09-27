import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Validate the delivered HTML against its editable content, without a browser,
// network access, third-party packages, or assumptions about source file order.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const config = readJSON('site.config.json');
const site = new URL(config.url);
const pages = readJSON('content/pages.json');
const news = readJSON('content/news.json');
const people = readJSON('content/people.json');
const publications = readJSON('content/publications.json');
const projects = readJSON('content/research.json');
const inventory = readJSON('content/migration-inventory.json');
const manifest = readJSON('content/media-manifest.json');
const media = readJSON('content/media-map.json');
const display = fs.existsSync(path.join(root, 'content/media-display-map.json')) ? readJSON('content/media-display-map.json') : {};
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
  const target = display[imageURL] || media[imageURL];
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
  canonical(document);
  for (const [id, entries] of document.ids) check(entries.length === 1, `${document.relative}: duplicate id ${id}`);
  for (const node of document.elements) {
    for (const attribute of ['href', 'src', 'poster']) {
      if (attribute in node.attrs) validateURL(node.attrs[attribute], location, `${document.relative} <${node.tag}> ${attribute}`, { image: node.tag === 'img' && attribute === 'src' });
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

check(pages.length === inventory.pageCount + inventory.postCount, 'Editable pages do not match the migration inventory; update the inventory after intentional page additions/removals.');
check(inventory.missingSitemapUrls.length === 0, 'Migration inventory has missing sitemap URLs.');
const canonicalPages = new Set();
for (const page of pages) {
  const document = documentForPath(page.path);
  check(!!document, `Source page ${page.title}: original pathname ${page.path} is missing`);
  if (!document) continue;
  const route = canonical(document);
  if (route) { canonicalPages.add(route); check(!!documentForPath(route), `Source page ${page.title}: canonical route ${route} is missing`); }
  for (const image of page.images || []) assertImage(document.document, image.url, `Source page ${page.title}`);
  // Profiles are rendered from their complete HTML; require the full original text.
  if (!['/', '/news/', '/publications/', '/research/', '/contact/'].includes(page.path) && page.slug !== 'people') assertContent(document.document, page.text, `Profile ${page.title}`);
}
check(canonicalPages.size === pages.length, 'Two source pages resolve to the same canonical page.');
for (const source of inventory.pages) check(pages.some(page => page.id === source.id && unquote(page.path) === unquote(source.path)), `Migration inventory page ${source.id} / ${source.title} has been dropped.`);

const newsDocument = documentForPath('/news/');
const peopleDocument = documentForPath('/people/');
const publicationDocument = documentForPath('/publications/');
const researchDocument = documentForPath('/research/');
for (const [records, doc, className, label] of [[news, newsDocument, 'news-entry', 'news'], [people, peopleDocument, 'person-card', 'people'], [publications, publicationDocument, 'publication-item', 'publications'], [projects, researchDocument, 'project-entry', 'research']]) {
  check(!!doc, `Missing ${label} listing page`);
  if (doc) check(doc.elements.filter(n => hasClass(n, className)).length === records.length, `${label}: rendered count differs from ${records.length} editable records`);
  check(new Set(records.map(record => record.id)).size === records.length, `${label}: duplicate content record ids`);
}
for (const item of news) {
  const node = recordNode(newsDocument, item, `News ${item.id}`);
  assertContent(node, textHTML(item.bodyHtml), `News ${item.id}`);
  for (const image of item.images || []) assertImage(node, image.url, `News ${item.id}`);
}
for (const person of people) {
  const node = recordNode(peopleDocument, person, `Person ${person.name}`);
  assertContent(node, person.name, `Person ${person.name}`);
  assertImage(node, person.image, `Person ${person.name}`);
  if (person.profilePath && node) {
    const original = documentForPath(person.profilePath);
    check(!!original, `Person ${person.name}: missing original profile path`);
    if (original) check(node.attrs.href === canonical(original), `Person ${person.name}: profile card links to the wrong person`);
  }
}
for (const publication of publications) {
  const node = recordNode(publicationDocument, publication, `Publication ${publication.id}`);
  assertContent(node, publication.citation, `Publication ${publication.id}`);
  for (const link of publication.links || []) check(descendants(node).some(n => n.tag === 'a' && n.attrs.href === link.url), `Publication ${publication.id}: missing citation link ${link.url}`);
}
for (const project of projects) {
  const node = recordNode(researchDocument, project, `Research ${project.id}`);
  assertContent(node, project.title, `Research ${project.id} title`);
  assertContent(node, textHTML(project.descriptionHtml), `Research ${project.id} description`);
  for (const image of project.images || []) assertImage(node, image.url, `Research ${project.id}`);
}
const home = documentForPath('/');
const sourceHome = pages.find(page => page.path === '/');
if (home && sourceHome) {
  const paragraphs = parseHTML(sourceHome.html).elements.filter(n => n.tag === 'p' && normalized(text(n)).length > 150);
  for (const paragraph of paragraphs) assertContent(home.document, text(paragraph), 'Homepage introduction');
}
const contact = documentForPath('/contact/');
if (contact) {
  assertContent(contact.document, config.address, 'Contact address');
  check(contact.elements.some(n => n.tag === 'a' && n.attrs.href === 'mailto:' + config.email), 'Contact page is missing the email action.');
}

for (const item of manifest) {
  check(!!media[item.url], `Media manifest: missing archival mapping ${item.url}`);
  if (media[item.url]) {
    const file = fileForPath(media[item.url]);
    check(!!file && fs.statSync(file).size > 0, `Media manifest: original asset missing or empty ${media[item.url]}`);
  }
}
const search = readJSON('dist/search-index.json');
for (const record of search) validateURL(record.url, site, `Search result ${record.title}`);
for (const item of news) check(search.some(record => record.url === '/news/#' + item.id), `News ${item.id}: missing from search index`);
for (const item of publications) check(search.some(record => record.url === '/publications/#' + item.id), `Publication ${item.id}: missing from search index`);
for (const route of canonicalPages) if (!['/news/', '/publications/'].includes(route)) check(search.some(record => record.url === route), `Page ${route}: missing from search index`);
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
  console.log('Content preservation, links, anchors, image coverage, search, metadata and sitemap are valid.');
}
