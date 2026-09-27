import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createContent, helpText, parseArguments } from '../src/scaffold.mjs';

const templateRoot = fileURLToPath(new URL('../content/templates/', import.meta.url));
const files = ['news.json', 'people.json', 'research.json', 'publications.json', 'pages.json'];

function fixture(t, initial = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aimi-scaffold-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'content'));
  fs.cpSync(templateRoot, path.join(root, 'content', 'templates'), { recursive: true });
  for (const file of files) {
    fs.writeFileSync(path.join(root, 'content', file), `${JSON.stringify(initial[file] ?? [], null, 2)}\n`);
  }
  return root;
}

function read(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', file), 'utf8'));
}

function snapshot(root) {
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, 'content', file), 'utf8')]));
}

test('creates each content type from its template in the correct position', (t) => {
  const root = fixture(t, {
    'news.json': [{ id: 'news-existing' }],
    'people.json': [{ id: 'person-existing' }],
    'research.json': [{ id: 'research-existing' }],
    'publications.json': [{ id: 'publication-existing' }],
  });
  const cases = [
    ['news', 'news.json', 'news-demo', 0],
    ['member', 'people.json', 'person-demo', 1],
    ['research', 'research.json', 'research-demo', 1],
    ['publication', 'publications.json', 'publication-demo', 0],
  ];
  for (const [type, file, id, position] of cases) {
    const before = snapshot(root);
    const result = createContent({ root, type, slug: 'demo' });
    assert.equal(result.id, id);
    assert.deepEqual(result.files, [`content/${file}`]);
    assert.equal(read(root, file)[position].id, id);
    for (const other of files.filter((name) => name !== file)) {
      assert.equal(snapshot(root)[other], before[other]);
    }
  }
  const member = read(root, 'people.json')[1];
  assert.equal(member.group, 'phd');
  assert.equal(member.profilePath, null);
  assert.equal(member.image, '/assets/TODO-member.jpg');
  assert.ok(member.en.name.includes('TODO'));
  assert.ok(member.zh.name.includes('TODO'));
  const publication = read(root, 'publications.json')[0];
  assert.equal(publication.year, null);
  assert.equal(publication.section, 'AIMI');
  assert.equal(Object.hasOwn(publication, 'citation'), false);
  assert.equal(Object.hasOwn(publication, 'links'), false);
  assert.ok(publication.html.includes('TODO'));
});

test('profile creation adds a page and links exactly the selected member', (t) => {
  const originalOtherMember = { id: 'person-other', profilePath: null, en: { name: 'Other' } };
  const root = fixture(t, {
    'pages.json': [{ id: 'home', type: 'home', path: '/', aliases: [] }],
    'people.json': [{ id: 'person-jane', profilePath: null }, originalOtherMember],
  });
  const result = createContent({ root, type: 'profile', slug: 'jane-doe', member: 'person-jane' });
  assert.deepEqual(result.files, ['content/pages.json', 'content/people.json']);
  assert.equal(result.memberId, 'person-jane');
  assert.equal(result.profilePath, '/people/jane-doe/');
  const pages = read(root, 'pages.json');
  assert.equal(pages.length, 2);
  assert.equal(pages[1].id, 'profile-jane-doe');
  assert.equal(pages[1].type, 'profile');
  assert.equal(pages[1].path, '/people/jane-doe/');
  assert.deepEqual(pages[1].aliases, []);
  assert.ok(pages[1].en.html.includes('TODO'));
  assert.ok(pages[1].zh.html.includes('TODO'));
  assert.equal(read(root, 'people.json')[0].profilePath, '/people/jane-doe/');
  assert.deepEqual(read(root, 'people.json')[1], originalOtherMember);
});

test('duplicate IDs are rejected without changing any content files', (t) => {
  const root = fixture(t, { 'news.json': [{ id: 'news-existing', marker: 'keep' }] });
  const before = snapshot(root);
  assert.throws(() => createContent({ root, type: 'news', slug: 'existing' }), /已存在/);
  assert.deepEqual(snapshot(root), before);
});

test('profile canonical paths, old aliases and localized paths cannot be reused', async (t) => {
  for (const page of [
    { id: 'old', path: '/people/jane/' },
    { id: 'old', path: '/other/', aliases: ['/people/jane/'] },
    { id: 'old', path: '/other/', aliases: ['/people/%6aane'] },
    { id: 'old', path: '/other/', aliases: ['/people/jane/index.html'] },
    { id: 'old', path: '/other/', aliases: ['/zh/people/jane/'] },
  ]) {
    await t.test(JSON.stringify(page), (child) => {
      const root = fixture(child, { 'pages.json': [page], 'people.json': [{ id: 'person-jane', profilePath: null }] });
      const before = snapshot(root);
      assert.throws(() => createContent({ root, type: 'profile', slug: 'jane', member: 'person-jane' }), /冲突/);
      assert.deepEqual(snapshot(root), before);
    });
  }
});

test('profile requires one existing member without a personal page', async (t) => {
  for (const [members, member, expected] of [
    [[], undefined, /必须使用 --member/],
    [[], 'person-missing', /未找到成员/],
    [[{ id: 'person-jane', profilePath: '/people/old/' }], 'person-jane', /已设置个人主页/],
    [[{ id: 'person-jane' }, { id: 'person-jane' }], 'person-jane', /成员 ID .* 重复/],
  ]) {
    await t.test(String(expected), (child) => {
      const root = fixture(child, { 'people.json': members });
      const before = snapshot(root);
      assert.throws(() => createContent({ root, type: 'profile', slug: 'jane', member }), expected);
      assert.deepEqual(snapshot(root), before);
    });
  }
});

test('a profile cannot claim a path already linked to another member', (t) => {
  const root = fixture(t, { 'people.json': [
    { id: 'person-jane', profilePath: null },
    { id: 'person-other', profilePath: '/people/jane/' },
  ] });
  const before = snapshot(root);
  assert.throws(() => createContent({ root, type: 'profile', slug: 'jane', member: 'person-jane' }), /已由成员 person-other 使用/);
  assert.deepEqual(snapshot(root), before);
});

test('dry-run returns a complete profile plan without writing either file', (t) => {
  const root = fixture(t, { 'people.json': [{ id: 'person-jane', profilePath: null }] });
  const before = snapshot(root);
  const directoryBefore = fs.readdirSync(path.join(root, 'content')).sort();
  const result = createContent({ root, type: 'profile', slug: 'jane', member: 'person-jane', dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.entry.id, 'profile-jane');
  assert.equal(result.profilePath, '/people/jane/');
  assert.deepEqual(result.files, ['content/pages.json', 'content/people.json']);
  assert.deepEqual(snapshot(root), before);
  assert.deepEqual(fs.readdirSync(path.join(root, 'content')).sort(), directoryBefore);
});

test('unsafe or malformed slugs and unsupported options are rejected before writes', (t) => {
  const root = fixture(t);
  const before = snapshot(root);
  for (const slug of ['', '../escape', 'Jane', 'two words', 'under_score', '-leading', 'trailing-', 'two--dashes', '姓名', 'a/b', 'a?b']) {
    assert.throws(() => createContent({ root, type: 'news', slug }), /slug/);
  }
  assert.throws(() => createContent({ root, type: '__proto__', slug: 'demo' }), /不支持的内容类型/);
  assert.throws(() => createContent({ root, type: 'news', slug: 'demo', member: 'person-jane' }), /仅适用于 profile/);
  assert.deepEqual(snapshot(root), before);
});

test('command arguments support Chinese help and reject ambiguity', () => {
  assert.deepEqual(parseArguments(['news', 'demo', '--dry-run']), { type: 'news', slug: 'demo', dryRun: true });
  assert.deepEqual(parseArguments(['profile', 'jane', '--member', 'person-jane']), { type: 'profile', slug: 'jane', member: 'person-jane', dryRun: false });
  assert.deepEqual(parseArguments(['--member=person-jane', 'profile', 'jane']), { type: 'profile', slug: 'jane', member: 'person-jane', dryRun: false });
  assert.deepEqual(parseArguments(['--help']), { help: true });
  assert.match(helpText, /新增网站内容/);
  assert.throws(() => parseArguments(['news']), /内容类型和 slug/);
  assert.throws(() => parseArguments(['news', 'demo', 'extra']), /内容类型和 slug/);
  assert.throws(() => parseArguments(['profile', 'jane', '--member']), /已有成员 ID/);
  assert.throws(() => parseArguments(['profile', 'jane', '--member', 'one', '--member', 'two']), /只能指定一次/);
  assert.throws(() => parseArguments(['news', 'demo', '--unknown']), /未知选项/);
});

test('a failed second profile write rolls the first file back and removes temporary files', (t) => {
  const root = fixture(t, { 'people.json': [{ id: 'person-jane', profilePath: null }] });
  const before = snapshot(root);
  const directoryBefore = fs.readdirSync(path.join(root, 'content')).sort();
  const originalRename = fs.renameSync;
  let writes = 0;
  t.mock.method(fs, 'renameSync', (...args) => {
    writes += 1;
    if (writes === 2) {
      throw new Error('simulated second write failure');
    }
    return originalRename(...args);
  });
  assert.throws(() => createContent({ root, type: 'profile', slug: 'jane', member: 'person-jane' }), /已恢复本次操作写入的文件/);
  assert.deepEqual(snapshot(root), before);
  assert.deepEqual(fs.readdirSync(path.join(root, 'content')).sort(), directoryBefore);
});

test('a failed rollback preserves the original file in a recoverable backup', (t) => {
  const root = fixture(t, { 'people.json': [{ id: 'person-jane', profilePath: null }] });
  const before = snapshot(root);
  const originalRename = fs.renameSync;
  let writes = 0;
  t.mock.method(fs, 'renameSync', (...args) => {
    writes += 1;
    if (writes === 2 || writes === 3) {
      throw new Error('simulated destination failure');
    }
    return originalRename(...args);
  });
  assert.throws(() => createContent({ root, type: 'profile', slug: 'jane', member: 'person-jane' }), /原文件备份保留在/);
  const backups = fs.readdirSync(path.join(root, 'content')).filter((file) => file.endsWith('.rollback'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'content', backups[0]), 'utf8'), before['pages.json']);
  assert.equal(snapshot(root)['people.json'], before['people.json']);
});
