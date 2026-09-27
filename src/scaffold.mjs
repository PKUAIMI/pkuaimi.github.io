import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const types = {
  news: { file: 'news.json', prefix: 'news', prepend: true },
  member: { file: 'people.json', prefix: 'person', prepend: false },
  research: { file: 'research.json', prefix: 'research', prepend: false },
  publication: { file: 'publications.json', prefix: 'publication', prepend: true },
  profile: { file: 'pages.json', prefix: 'profile', prepend: false },
};

const contentFiles = ['news.json', 'people.json', 'research.json', 'publications.json', 'pages.json'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const helpText = `新增网站内容

用法：
  npm run new -- news <slug> [--dry-run]
  npm run new -- member <slug> [--dry-run]
  npm run new -- research <slug> [--dry-run]
  npm run new -- publication <slug> [--dry-run]
  npm run new -- profile <slug> --member <已有成员 ID> [--dry-run]

示例：
  npm run new -- news welcome-new-students
  npm run new -- member jane-doe
  npm run new -- research ct-reconstruction
  npm run new -- publication paper-2026
  npm run new -- profile jane-doe --member person-jane-doe

slug 只能使用小写英文字母、数字和连接词之间的单个连字符。
profile 必须关联已有且尚未设置个人主页的成员。
--dry-run 仅显示计划，不写入文件；--help 显示此帮助。

新条目使用 content/templates/ 下的 JSON 模板。创建后，请填写中英文
内容、替换 TODO 图片路径，并填写论文年份。包含 TODO 的内容不能发布。
`;

export function parseArguments(argv) {
  if (!Array.isArray(argv) || !argv.every((value) => typeof value === 'string')) {
    throw new Error('命令参数必须是字符串列表。');
  }
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }
  const positional = [];
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      if (result.dryRun) {
        throw new Error('--dry-run 只能指定一次。');
      }
      result.dryRun = true;
    } else if (arg === '--member' || arg.startsWith('--member=')) {
      if (result.member !== undefined) {
        throw new Error('--member 只能指定一次。');
      }
      const value = arg.startsWith('--member=') ? arg.slice('--member='.length) : argv[++index];
      if (!value || value.startsWith('-')) {
        throw new Error('--member 后必须提供已有成员 ID。');
      }
      result.member = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`未知选项：${arg}。使用 --help 查看用法。`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    throw new Error('请提供内容类型和 slug。使用 --help 查看用法。');
  }
  [result.type, result.slug] = positional;
  return result;
}

function readJson(file) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`无法读取 ${file}：${error.message}`, { cause: error });
  }
  try {
    return { source, value: JSON.parse(source) };
  } catch (error) {
    throw new Error(`${file} 不是有效的 JSON：${error.message}`, { cause: error });
  }
}

function normalizePath(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  let normalized;
  try {
    normalized = decodeURIComponent(new URL(value, 'https://content.invalid').pathname);
  } catch {
    throw new Error(`已有页面路径无效：${value}`);
  }
  normalized = normalized.replace(/\/{2,}/g, '/').replace(/\/index\.html$/, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function pagePaths(page) {
  const aliases = page.aliases ?? [];
  if (!Array.isArray(aliases) || !aliases.every((alias) => typeof alias === 'string')) {
    throw new Error(`页面 ${page.id} 的 aliases 必须是路径字符串列表。`);
  }
  return [page.path, ...aliases].map(normalizePath).filter(Boolean);
}

function renderTemplate(root, type, slug) {
  const templatePath = path.join(root, 'content', 'templates', `${type}.json`);
  const { value } = readJson(templatePath);
  const record = JSON.parse(JSON.stringify(value).replaceAll('{{slug}}', slug));
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`模板 ${templatePath} 必须是 JSON 对象。`);
  }
  if (record.id !== `${types[type].prefix}-${slug}`) {
    throw new Error(`模板 ${templatePath} 的 id 必须为 ${types[type].prefix}-{{slug}}。`);
  }
  if (type === 'profile' && (record.path !== `/people/${slug}/` || !Array.isArray(record.aliases))) {
    throw new Error('profile 模板需要 path 为 /people/{{slug}}/，且 aliases 为数组。');
  }
  return record;
}

function writeChanges(changes) {
  const staged = changes.map((change) => ({
    ...change,
    temporary: path.join(path.dirname(change.path), `.${path.basename(change.path)}.${randomUUID()}.tmp`),
    mode: fs.statSync(change.path).mode & 0o777,
  }));
  const written = [];
  const cleanup = new Set(staged.map((change) => change.temporary));
  try {
    for (const change of staged) {
      fs.writeFileSync(change.temporary, change.updated, { flag: 'wx', mode: change.mode });
    }
    // Refuse to overwrite content that changed after the plan was prepared.
    for (const change of staged) {
      if (fs.readFileSync(change.path, 'utf8') !== change.original) {
        throw new Error(`${change.path} 已被其他操作修改，请重新运行命令。`);
      }
    }
    for (const change of staged) {
      fs.renameSync(change.temporary, change.path);
      written.push(change);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const change of written.reverse()) {
      const rollback = path.join(path.dirname(change.path), `.${path.basename(change.path)}.${randomUUID()}.rollback`);
      cleanup.add(rollback);
      let backupReady = false;
      try {
        fs.writeFileSync(rollback, change.original, { flag: 'wx', mode: change.mode });
        backupReady = true;
        fs.renameSync(rollback, change.path);
      } catch (rollbackError) {
        if (backupReady) {
          cleanup.delete(rollback);
        }
        rollbackErrors.push(`${change.path}：${rollbackError.message}${backupReady ? `；原文件备份保留在 ${rollback}` : ''}`);
      }
    }
    const detail = rollbackErrors.length
      ? `以下文件恢复失败，请检查：${rollbackErrors.join('；')}`
      : written.length ? '已恢复本次操作写入的文件。' : '原文件未改动。';
    throw new Error(`新增内容失败：${error.message} ${detail}`, { cause: error });
  } finally {
    for (const file of cleanup) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // Keep the original error if temporary-file cleanup also fails.
      }
    }
  }
}

/** Create a draft from a template, or return its plan without writing when dryRun is true. */
export function createContent({ root, type, slug, member, dryRun = false }) {
  if (typeof root !== 'string' || !root) {
    throw new Error('请提供仓库根目录 root。');
  }
  if (!Object.hasOwn(types, type)) {
    throw new Error(`不支持的内容类型：${type}。可用类型：${Object.keys(types).join('、')}。`);
  }
  if (typeof slug !== 'string' || !slugPattern.test(slug)) {
    throw new Error('slug 只能使用小写英文字母、数字和连接词之间的单个连字符，例如 jane-doe。');
  }
  if (typeof dryRun !== 'boolean') {
    throw new Error('dryRun 必须是布尔值。');
  }
  if (type === 'profile' && (typeof member !== 'string' || !member.trim())) {
    throw new Error('创建 profile 必须使用 --member 指定已有成员 ID。');
  }
  if (type !== 'profile' && member !== undefined) {
    throw new Error('--member 仅适用于 profile。');
  }

  const absoluteRoot = path.resolve(root);
  const documents = new Map(contentFiles.map((file) => {
    const filePath = path.join(absoluteRoot, 'content', file);
    const document = readJson(filePath);
    if (!Array.isArray(document.value)) {
      throw new Error(`${filePath} 的顶层内容必须是 JSON 数组。`);
    }
    if (!document.value.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))) {
      throw new Error(`${filePath} 中的每条内容都必须是 JSON 对象。`);
    }
    return [file, { ...document, path: filePath }];
  }));
  const record = renderTemplate(absoluteRoot, type, slug);
  for (const [file, document] of documents) {
    if (document.value.some((entry) => String(entry.id) === record.id)) {
      throw new Error(`ID ${record.id} 已存在于 content/${file}，未覆盖原条目。`);
    }
  }

  let linkedMember;
  if (type === 'profile') {
    const members = documents.get('people.json').value.filter((entry) => entry.id === member);
    if (members.length !== 1) {
      throw new Error(members.length ? `成员 ID ${member} 重复，请先修正 people.json。` : `未找到成员 ${member}。请先创建成员，或检查 --member。`);
    }
    [linkedMember] = members;
    if (linkedMember.profilePath !== undefined && linkedMember.profilePath !== null && linkedMember.profilePath !== '') {
      throw new Error(`成员 ${member} 已设置个人主页 ${linkedMember.profilePath}，不会覆盖。`);
    }
    const paths = pagePaths(record);
    if (new Set(paths).size !== paths.length) {
      throw new Error('profile 模板中的页面路径和 aliases 相互重复。');
    }
    const newPaths = new Set(paths.flatMap((value) => [value, `/zh${value}`]));
    for (const page of documents.get('pages.json').value) {
      const conflict = pagePaths(page).find((value) => newPaths.has(value) || newPaths.has(`/zh${value}`));
      if (conflict) {
        throw new Error(`页面路径 ${record.path} 与页面 ${page.id} 的路径或旧链接 ${conflict} 冲突，未写入文件。`);
      }
    }
    for (const existingMember of documents.get('people.json').value) {
      const existingPath = normalizePath(existingMember.profilePath);
      if (existingPath && (newPaths.has(existingPath) || newPaths.has(`/zh${existingPath}`))) {
        throw new Error(`页面路径 ${record.path} 已由成员 ${existingMember.id} 使用，未写入文件。`);
      }
    }
  }

  const target = documents.get(types[type].file);
  if (types[type].prepend) {
    target.value.unshift(record);
  } else {
    target.value.push(record);
  }
  const modified = [types[type].file];
  if (linkedMember) {
    linkedMember.profilePath = record.path;
    modified.push('people.json');
  }
  const changes = modified.map((file) => {
    const document = documents.get(file);
    return { path: document.path, original: document.source, updated: `${JSON.stringify(document.value, null, 2)}\n` };
  });
  const result = {
    type,
    id: record.id,
    dryRun,
    files: modified.map((file) => `content/${file}`),
    entry: record,
    ...(linkedMember ? { memberId: member, profilePath: record.path } : {}),
  };
  if (!dryRun) {
    writeChanges(changes);
  }
  return result;
}
