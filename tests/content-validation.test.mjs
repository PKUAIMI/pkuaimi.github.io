import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateContent } from '../src/content-validation.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aimi-content-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'public/assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/assets/photo.jpg'), 'image fixture');
  const image = '/assets/photo.jpg';
  const data = {
    config: {url: 'https://pkuaimi.github.io', email: 'lab@example.com', github: 'https://github.com/example', repository: 'https://github.com/example/website'},
    pages: [
      { id: 1, type: 'home', path: '/', aliases: [], en: { title: 'Home', html: '<p>Welcome.</p>' }, zh: { title: '首页', html: '<p>欢迎。</p>' } },
      ...['news', 'people', 'research', 'publications', 'contact'].map(type => ({ id: type, type, path: `/${type}/`, aliases: [] })),
      { id: 'profile-jane', type: 'profile', path: '/people/jane/', aliases: ['/old-jane/'], en: { title: 'Jane', html: '<p>Researcher.</p>' }, zh: { title: 'Jane', html: '<p>研究人员。</p>' } },
    ],
    news: [{ id: 'news-welcome', images: [{ url: image }], date: '2024-02-29', dateKind: 'event', en: { title: 'Welcome', bodyHtml: '<p>Hello.</p>' }, zh: { title: '欢迎', bodyHtml: '<p>你好。</p>' } }],
    people: [{ id: 'person-jane', group: 'faculty', image, profilePath: '/people/jane/', en: { name: 'Jane' }, zh: { name: 'Jane' } }],
    projects: [{ id: 'research-ct', images: [{ url: image }], en: { title: 'CT imaging', descriptionHtml: '' }, zh: { title: 'CT 成像', descriptionHtml: '' } }],
    publications: [{ id: 'publication-ct', year: 2026, section: 'AIMI', citation: 'Jane. Imaging. 2026.', html: '<p>Jane. Imaging. 2026.</p>', links: [] }],
    groups: [{ id: 'faculty', en: 'Faculty', zh: '教师' }],
    ui: { en: { photo: 'Our lab' }, zh: { photo: '实验室' } },
    home: { hero: [{ original: image, display: image, width: 100, height: 100, altKey: 'photo', captionKey: 'photo' }], gallery: [{ url: image, altKey: 'photo', captionKey: 'photo' }], newsLimit: 3, publicationLimit: 3 },
    media: {}, displayMedia: {}, provenance: {},
  };
  return { root, data, validate: () => validateContent(data, { root }) };
}

test('accepts complete bilingual records, a leap-day event, and an intentionally empty research description without mutation', t => {
  const { data, validate } = fixture(t);
  const original = structuredClone(data);
  assert.deepEqual(validate(), []);
  assert.deepEqual(data, original);
});

test('reports the file, record, and missing translation field', t => {
  const { data, validate } = fixture(t);
  delete data.news[0].zh.bodyHtml;
  assert.match(validate().join('\n'), /content\/news\.json \[news-welcome\] · zh\.bodyHtml/);
});

test('requires carousel photos with real assets, dimensions and bilingual captions', t => {
  const { data, validate } = fixture(t);
  data.home.hero = [];
  assert.match(validate().join('\n'), /hero.*至少/);
  data.home.hero = [{ original: '/assets/missing.jpg', display: '/assets/photo.jpg', width: 0, height: 100, altKey: 'photo', captionKey: 'missing' }];
  const errors = validate().join('\n');
  assert.match(errors, /hero\[0\]\.original/);
  assert.match(errors, /hero\[0\]\.width/);
  assert.match(errors, /hero\[0\]\.captionKey/);
});

test('rejects duplicate identifiers and encoded aliases that collide with canonical paths', t => {
  const { data, validate } = fixture(t);
  data.news.push(structuredClone(data.news[0]));
  data.pages.at(-1).aliases.push('/%6eews/');
  const errors = validate().join('\n');
  assert.match(errors, /news-welcome.*id.*重复/);
  assert.match(errors, /profile-jane.*aliases\[1\].*重复/);
});

test('rejects output namespaces and encoded traversal before build output can be written', t => {
  const { data, validate } = fixture(t);
  data.pages.at(-1).aliases = ['/zh/news/', '/assets/photo/', '/safe/%2e%2e/escape/', '/safe%2fescape/'];
  const errors = validate();
  for (let index = 0; index < 4; index++) assert.ok(errors.some(error => error.includes(`aliases[${index}]`)));
});

test('catches member group and profile associations rather than accepting a legacy alias', t => {
  const { data, validate } = fixture(t);
  data.people[0].group = 'unknown';
  data.people[0].profilePath = '/old-jane/';
  const errors = validate().join('\n');
  assert.match(errors, /person-jane.*group/);
  assert.match(errors, /person-jane.*profilePath/);
});

test('accepts archived images only when their local source exists and requires project thumbnails', t => {
  const { data, validate } = fixture(t);
  const old = 'https://pkuaimi.com/wp-content/uploads/photo.jpg';
  data.media[old] = '/assets/photo.jpg';
  data.news[0].images[0].url = old;
  assert.deepEqual(validate(), []);
  data.media[old] = '/assets/missing.jpg';
  data.projects[0].images = [];
  const errors = validate().join('\n');
  assert.match(errors, /news-welcome.*images\[0\]\.url.*missing\.jpg/);
  assert.match(errors, /research-ct.*images.*至少需要一张/);
});

test('rejects impossible dates, malformed field types, and incomplete placeholder prose', t => {
  const { data, validate } = fixture(t);
  data.news[0].date = '2025-02-29';
  data.news[0].images = null;
  data.news[0].en.bodyHtml = '<p>TODO: add details.</p>';
  data.publications[0].year = '2026';
  data.publications[0].section = 'Other';
  const errors = validate().join('\n');
  for (const field of ['date', 'images', 'en.bodyHtml', 'year', 'section']) assert.ok(errors.includes(`· ${field}：`));
});

test('flags English Chinese text including numeric entities, but permits Chinese image alt text', t => {
  const { data, validate } = fixture(t);
  data.news[0].en.bodyHtml = '<p>Hello.</p><img src="/assets/photo.jpg" alt="中文说明">';
  assert.deepEqual(validate(), []);
  data.news[0].en.bodyHtml += '<p>&#x4e2d;&#25991;</p>';
  assert.match(validate().join('\n'), /en\.bodyHtml.*英文版本正文中仍含中文/);
});

test('checks images embedded in profile prose, including single-quoted HTML attributes', t => {
  const { data, validate } = fixture(t);
  data.pages.at(-1).en.html += "<img src='/assets/not-uploaded.jpg' alt='Portrait'>";
  assert.match(validate().join('\n'), /content\/pages\.json \[profile-jane\].*en\.html 图片\[0\]\.src.*not-uploaded\.jpg/);
});

test('returns validation errors for malformed records and top-level data without exiting', t => {
  const { data, validate } = fixture(t);
  data.news = [null, false, 'bad'];
  data.people = {};
  data.home = null;
  assert.ok(validate().length >= 5);
  assert.deepEqual(validateContent(null), ['网站内容：应为对象。']);
});

test('reports invalid site configuration and listing routes before template rendering', t => {
  const {data, validate} = fixture(t);
  data.config.url = 'https://pkuaimi.github.io/';
  data.config.email = 'not an address';
  data.pages.find(page => page.type === 'news').path = '/updates/';
  const errors = validate().join('\n');
  assert.match(errors, /site.config.json.*url/);
  assert.match(errors, /site.config.json.*email/);
  assert.match(errors, /content\/pages.json.*path.*\/news\//);
});

test('rejects an unfilled DOI placeholder even after visible citation text is complete', t => {
  const {data, validate} = fixture(t);
  data.publications[0].html = '<p>A. Author. A complete citation. <a href="https://doi.org/TODO">DOI</a></p>';
  assert.match(validate().join('\n'), /publication-ct.*html.*TODO/);
});
