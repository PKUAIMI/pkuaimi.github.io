import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ROOT, loadContent } from '../src/content.mjs';
import { buildSite } from '../src/build-site.mjs';
import { createContent } from '../src/scaffold.mjs';

// Exercise the editor workflow in an isolated copy; never add examples to the lab site.
test('new content builds in both languages without changing rendering code', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aimi-build-workflow-'));
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const write = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
  const output = file => fs.readFileSync(path.join(root, 'dist', file), 'utf8');
  try {
    fs.cpSync(path.join(ROOT, 'content'), path.join(root, 'content'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'public'), path.join(root, 'public'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'site.config.json'), path.join(root, 'site.config.json'));
    const before = await loadContent(root);
    await buildSite({ root });
    const validHome = output('index.html');
    assert.match(validHome, /type="module" src="\/assets\/scroll\/home-scroll\.js/);
    assert.doesNotMatch(output('news/index.html'), /assets\/scroll\//, 'inner pages must not load the scrolling engine');
    for (const id of ['home', 'updates', 'research', 'about', 'contact']) {
      for (const prefix of ['', 'zh/']) assert.match(output(`${prefix}index.html`), new RegExp(`id="${id}"[^>]*data-story-section`));
    }
    assert.ok(fs.statSync(path.join(root, 'dist/assets/scroll/home-scroll.js')).size < 230_000, 'keep the optional homepage bundle bounded');

    for (const type of ['news', 'member', 'research', 'publication']) createContent({ root, type, slug: 'workflow-example' });
    createContent({ root, type: 'profile', slug: 'workflow-example', member: 'person-workflow-example' });
    await assert.rejects(() => buildSite({ root }), /TODO/);
    assert.equal(output('index.html'), validHome, 'unfinished content must not replace a valid preview');

    const photo = '/assets/lab-group-2026-web.jpg';
    const news = read('content/news.json');
    Object.assign(news[0], {
      images: [{url: photo}, {url: '/assets/lab-group-2025-web.jpg'}],
      en: {title: 'Example lab event', bodyHtml: '<p>English event details.</p>'},
      zh: {title: '示例实验室活动', bodyHtml: '<p>中文活动内容。</p>'},
    });
    news.splice(1, 0, {id: 'news-without-photo', images: [], en: {title: 'Text news', bodyHtml: '<p>A text-only update.</p>'}, zh: {title: '文字新闻', bodyHtml: '<p>不带图片的动态。</p>'}});
    write('content/news.json', news);

    const people = read('content/people.json');
    Object.assign(people.find(item => item.id === 'person-workflow-example'), {
      image: photo, en: {name: 'Example Member'}, zh: {name: '示例成员'},
    });
    write('content/people.json', people);
    const pages = read('content/pages.json');
    Object.assign(pages.find(item => item.id === 'profile-workflow-example'), {
      aliases: ['/former-example/'],
      en: {title: 'Example Member', html: "<p>Example research biography. <a href='/research/'>Research</a></p>"},
      zh: {title: '示例成员', html: "<p>示例研究简介。<a href='/research/'>研究方向</a></p>"},
    });
    write('content/pages.json', pages);
    const projects = read('content/research.json');
    Object.assign(projects.find(item => item.id === 'research-workflow-example'), {
      images: [{url: photo}], en: {title: 'Example Research', descriptionHtml: ''},
      zh: {title: '示例研究', descriptionHtml: ''},
    });
    write('content/research.json', projects);
    const publications = read('content/publications.json');
    Object.assign(publications[0], {year: 2026, html: '<p>A. Author. Example paper. <a href="https://doi.org/10.1000/example">DOI</a></p>'});
    write('content/publications.json', publications);
    const labLives = read('content/lab-lives.json');
    labLives.push({ id: 'lab-life-workflow-example', original: photo,
      en: {caption: 'Example lab gathering', alt: 'Members together'},
      zh: {caption: '示例实验室相聚', alt: '成员合影'},
    });
    write('content/lab-lives.json', labLives);

    const counts = await buildSite({ root });
    assert.equal(counts.pages, before.pages.length + 1);
    assert.equal(counts.news, before.news.length + 2);
    const data = await loadContent(root);
    assert.equal(data.publications[0].citation, 'A. Author. Example paper. DOI');
    assert.deepEqual(data.publications[0].links, [{url: 'https://doi.org/10.1000/example', text: 'DOI'}]);
    for (const prefix of ['', 'zh/']) {
      const peoplePage = output(`${prefix}people/index.html`);
      assert.match(peoplePage, /id="lab-life-workflow-example"/);
      assert.ok(peoplePage.includes(prefix ? '示例实验室相聚' : 'Example lab gathering'));
      assert.ok(peoplePage.indexOf('id="lab-lives"') > peoplePage.lastIndexOf('class="person-card"'), 'lab photos follow all member groups');
      assert.match(output(`${prefix}news/index.html`), /id="news-workflow-example"/);
      assert.match(output(`${prefix}news/index.html`), /id="news-without-photo"/);
      assert.match(output(`${prefix}people/index.html`), new RegExp(`href="/${prefix}people/workflow-example/"`));
      assert.match(output(`${prefix}people/workflow-example/index.html`), /id="main"/);
      assert.match(output(`${prefix}people/workflow-example/index.html`), new RegExp(`href="/${prefix}research/"`));
      assert.match(output(`${prefix}research/index.html`), /id="research-workflow-example"/);
      assert.match(output(`${prefix}publications/index.html`), /https:\/\/doi.org\/10.1000\/example/);
      const search = read(`dist/${prefix}search-index.json`);
      assert.ok(search.some(item => item.url === `/${prefix}people/workflow-example/`));
      assert.ok(search.some(item => item.url === `/${prefix}news/#news-workflow-example`));
      // Linked citations must not be wrapped in another anchor on the homepage.
      assert.doesNotMatch(output(`${prefix}index.html`), /<a[^>]*><p>A\. Author/);
    }
    assert.equal(output('former-example/index.html'), output('people/workflow-example/index.html'));
    assert.match(output('sitemap.xml'), /\/zh\/people\/workflow-example\//);
    assert.doesNotMatch(output('news/index.html'), /示例实验室活动/);
    assert.match(output('zh/news/index.html'), /示例实验室活动/);

    // Renaming a path while retaining an alias is data-only; duplicate aliases fail before writing.
    const currentHome = output('index.html');
    pages.at(-1).aliases.push('/news/');
    write('content/pages.json', pages);
    await assert.rejects(() => buildSite({ root }), /重复/);
    assert.equal(output('index.html'), currentHome);
    pages.at(-1).aliases.pop();
    pages.pop();
    people.find(item => item.id === 'person-workflow-example').profilePath = null;
    write('content/pages.json', pages);
    write('content/people.json', people);
    fs.writeFileSync(path.join(root, 'keep-user-file.txt'), 'owned by the maintainer');
    await buildSite({ root });
    assert.equal(fs.existsSync(path.join(root, 'dist/people/workflow-example/index.html')), false);
    assert.equal(fs.existsSync(path.join(root, 'former-example/index.html')), false);
    assert.equal(fs.readFileSync(path.join(root, 'keep-user-file.txt'), 'utf8'), 'owned by the maintainer');

    // Folder edits alone must reach both published editions and clean up on removal.
    const addedPhoto = 'assets/home-slides/04-folder-addition.jpg';
    fs.copyFileSync(path.join(root, 'public/assets/lab-group-2026-web.jpg'), path.join(root, 'public', addedPhoto));
    await buildSite({ root });
    for (const prefix of ['', 'zh/']) assert.ok(output(`${prefix}index.html`).includes(`/${addedPhoto}`));
    fs.unlinkSync(path.join(root, 'public', addedPhoto));
    await buildSite({ root });
    for (const prefix of ['', 'zh/']) assert.ok(!output(`${prefix}index.html`).includes(`/${addedPhoto}`));
    assert.equal(fs.existsSync(path.join(root, addedPhoto)), false);
    assert.equal(fs.existsSync(path.join(root, 'dist', addedPhoto)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
