import fs from 'node:fs';
import path from 'node:path';

const LANGUAGES = ['en', 'zh'];
const PAGE_TYPES = new Set(['home', 'news', 'people', 'research', 'publications', 'contact', 'profile', 'page']);
const SINGLETON_TYPES = new Set(['home', 'news', 'people', 'research', 'publications', 'contact']);
const RESERVED_PATHS = new Set([
  'zh', 'assets', 'dist', 'public', 'content', 'src', 'scripts', 'tests', 'migration', '__aimi_preview__',
  'node_modules', '404.html', 'styles.css', 'home.css', 'site.js', 'search-index.json', 'tsconfig.json',
  'sitemap.xml', 'robots.txt', 'generated-files.json', 'site.config.json',
  'package.json', 'package-lock.json', 'readme.md', 'cname',
]);
const RESERVED_IDS = new Set(['main', 'home', 'updates', 'research', 'about', 'contact', 'story-research-heading', 'story-about-heading', 'lab-welcome', 'lab-lives', 'lab-lives-heading', 'primary-navigation', 'content-filter', 'year-filter', 'search-dialog', 'search-input', 'search-results', 'search-title', 'image-preview-title']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const isNonempty = value => isString(value) && value.trim().length > 0;
const plainText = value => String(value).replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (match, encoded) => {
  const point = encoded[0].toLowerCase() === 'x' ? parseInt(encoded.slice(1), 16) : Number(encoded);
  return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
});

/**
 * Validate editable content before any generated files are written.
 * Returns all actionable errors; it never changes content or exits the process.
 */
export function validateContent(data, { root = process.cwd() } = {}) {
  const errors = [];
  const fail = (location, field, message) => errors.push(`${location} · ${field}：${message}`);
  if (!isObject(data)) return ['网站内容：应为对象。'];
  const directory = path.resolve(root);
  const where = (file, item, index) => `${file} [${item?.id ?? `第 ${index + 1} 条`}]`;
  const text = (value, location, field, { empty = false, language } = {}) => {
    if (!isString(value) || (!empty && !value.trim())) {
      fail(location, field, empty ? '应为字符串，可留空。' : '应为非空字符串。');
      return;
    }
    const visible = plainText(value);
    if (/\b(?:TODO|FIXME|Lorem\s+ipsum)\b/i.test(value)) fail(location, field, '请替换 TODO / FIXME / Lorem ipsum 占位内容（包括链接地址）。');
    if (language === 'en' && /\p{Script=Han}/u.test(visible)) fail(location, field, '英文版本正文中仍含中文；请将中文放到 zh 对应字段。');
    if (/(?:^|\.)(?:html|bodyHtml|descriptionHtml)$/.test(field)) {
      let index = 0;
      for (const match of value.matchAll(/<img\b[^>]*>/gi)) {
        const source = match[0].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        asset((source?.[1] ?? source?.[2] ?? source?.[3] ?? '').replace(/&amp;/g, '&'), location, `${field} 图片[${index++}].src`);
      }
    }
  };
  const records = (key, file, { numericId = false } = {}) => {
    if (!Array.isArray(data[key])) { fail(file, '文件内容', '应为数组。'); return []; }
    const ids = new Set();
    return data[key].filter((item, index) => {
      const location = where(file, item, index);
      if (!isObject(item)) { fail(location, '条目', '应为对象。'); return false; }
      const validId = (numericId && Number.isSafeInteger(item.id) && item.id > 0) || (isString(item.id) && /^[a-z0-9][a-z0-9_-]*$/.test(item.id));
      // Page IDs are metadata; only content record IDs become document anchors.
      if (!validId || (key !== 'pages' && RESERVED_IDS.has(String(item.id)))) fail(location, 'id', numericId ? '请使用正整数或小写英文、数字、连字符、下划线组成的唯一标识。' : '请使用小写英文、数字、连字符、下划线组成的唯一标识，且不能使用页面保留标识。');
      if (ids.has(String(item.id))) fail(location, 'id', '与本文件其他条目重复；已有条目的 id 请保持稳定。');
      ids.add(String(item.id));
      return true;
    });
  };
  const translations = (item, location, fields) => {
    for (const language of LANGUAGES) {
      if (!isObject(item[language])) { fail(location, language, '缺少语言对象；每条内容都要填写 en 和 zh。'); continue; }
      for (const [field, empty] of Object.entries(fields)) text(item[language][field], location, `${language}.${field}`, { empty, language });
    }
  };
  const asset = (source, location, field) => {
    if (!isNonempty(source)) { fail(location, field, '请填写 /assets/ 下的图片路径。'); return; }
    let local = source;
    if (!source.startsWith('/assets/')) {
      const mapped = isObject(data.media) ? data.media[source] : null;
      if (!isString(mapped)) { fail(location, field, `图片 ${source} 不是本地 /assets/ 路径，也没有已有迁移映射。`); return; }
      local = mapped;
    }
    let decoded;
    try { decoded = decodeURIComponent(local); } catch { fail(location, field, `图片路径编码不正确：${local}`); return; }
    if (!decoded.startsWith('/assets/') || /[\\?#\u0000-\u001f]/.test(decoded) || decoded.split('/').some(segment => segment === '.' || segment === '..')) {
      fail(location, field, `图片路径不安全：${local}`); return;
    }
    const publicRoot = path.join(directory, 'public');
    const filename = path.resolve(publicRoot, decoded.slice(1));
    if (!filename.startsWith(publicRoot + path.sep)) { fail(location, field, `图片必须位于 public/assets/：${local}`); return; }
    try {
      if (!fs.statSync(filename).isFile() || fs.statSync(filename).size === 0) fail(location, field, `图片不存在或为空：public${decoded}`);
    } catch { fail(location, field, `找不到图片 public${decoded}；请先把文件放入 public/assets/。`); }
  };
  const images = (value, location, { required = false } = {}) => {
    if (!Array.isArray(value)) { fail(location, 'images', '应为图片对象数组，无图片时填写 []。'); return; }
    if (required && value.length === 0) fail(location, 'images', '研究项目至少需要一张图片，用于首页展示。');
    for (const [index, image] of value.entries()) {
      if (!isObject(image)) { fail(location, `images[${index}]`, '应为包含 url 的对象。'); continue; }
      asset(image.url, location, `images[${index}].url`);
      if ('alt' in image) text(image.alt, location, `images[${index}].alt`, { empty: true });
    }
  };

  if (!isObject(data.config)) fail('site.config.json', '文件内容', '应为网站设置对象。');
  else {
    for (const field of ['url', 'github', 'repository']) {
      try {
        const url = new URL(data.config[field]);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        if (field === 'url' && (url.origin !== data.config.url)) throw new Error();
      } catch {
        fail('site.config.json', field, field === 'url'
          ? '请填写不带末尾斜杠的完整网站地址，例如 https://pkuaimi.github.io。'
          : '请填写完整的 http 或 https 链接。');
      }
    }
    if (!isString(data.config.email) || !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(data.config.email)) {
      fail('site.config.json', 'email', '请填写有效的邮箱地址。');
    }
  }

  const pages = records('pages', 'content/pages.json', { numericId: true });
  const news = records('news', 'content/news.json');
  const people = records('people', 'content/people.json');
  const labLives = records('labLives', 'content/lab-lives.json');
  const projects = records('projects', 'content/research.json');
  const publications = records('publications', 'content/publications.json');
  const groups = records('groups', 'content/groups.json');
  const groupIds = new Set(groups.map(group => group.id));
  for (const [index, group] of groups.entries()) for (const language of LANGUAGES) text(group[language], where('content/groups.json', group, index), language, { language });

  const paths = new Map();
  const pageTypes = new Map();
  const pageByPath = new Map();
  const route = (value, location, field) => {
    if (!isString(value) || !value.startsWith('/') || !value.endsWith('/')) { fail(location, field, '页面地址必须以 / 开头和结尾，例如 /people/jane-doe/。'); return; }
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { fail(location, field, '页面地址的百分号编码不正确。'); return; }
    const segments = decoded.split('/').filter(Boolean);
    if (/[\\?#%\s\u0000-\u001f<>"']/.test(decoded) || /%2f|%5c/i.test(value) || decoded.includes('//') || segments.some(segment => segment === '.' || segment === '..' || segment.startsWith('.'))) {
      fail(location, field, '页面地址含不安全字符或路径跳转，请使用清晰的目录地址。'); return;
    }
    if (RESERVED_PATHS.has(segments[0]?.toLowerCase())) { fail(location, field, `/${segments[0]}/ 是系统保留地址，请使用其他路径。`); return; }
    const key = decoded.toLowerCase();
    if (paths.has(key)) fail(location, field, `与 ${paths.get(key)} 的页面地址或旧地址重复。`);
    else paths.set(key, `${location} · ${field}`);
    return key;
  };
  for (const [index, page] of pages.entries()) {
    const location = where('content/pages.json', page, index);
    if (!PAGE_TYPES.has(page.type)) fail(location, 'type', `未知页面类型；可用 ${[...PAGE_TYPES].join('、')}。`);
    if (SINGLETON_TYPES.has(page.type)) {
      if (pageTypes.has(page.type)) fail(location, 'type', `${page.type} 页面只能有一个，与 ${pageTypes.get(page.type)} 重复。`);
      pageTypes.set(page.type, location);
    }
    const key = route(page.path, location, 'path');
    if (key) pageByPath.set(key, page);
    if (page.type === 'home' && page.path !== '/') fail(location, 'path', '首页地址必须为 /。');
    if (SINGLETON_TYPES.has(page.type) && page.type !== 'home' && page.path !== `/${page.type}/`) {
      fail(location, 'path', `${page.type} 栏目地址必须为 /${page.type}/，以保持导航与搜索链接一致。`);
    }
    if (page.path === '/' && page.type !== 'home') fail(location, 'type', '/ 地址只能用于 home 首页。');
    if (['home', 'profile', 'page'].includes(page.type)) translations(page, location, { title: false, html: false });
    if ('aliases' in page && !Array.isArray(page.aliases)) fail(location, 'aliases', '应为旧地址数组，无旧地址时填写 []。');
    else for (const [aliasIndex, alias] of (page.aliases || []).entries()) route(alias, location, `aliases[${aliasIndex}]`);
  }
  for (const type of SINGLETON_TYPES) if (!pageTypes.has(type)) fail('content/pages.json', 'type', `缺少 ${type} 页面。`);

  for (const [index, item] of news.entries()) {
    const location = where('content/news.json', item, index);
    translations(item, location, { title: false, bodyHtml: false });
    images(item.images, location);
    if ('date' in item) {
      const match = isString(item.date) && item.date.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
      let valid = !!match;
      if (match) {
        const year = Number(match[1]), month = Number(match[2]), day = match[3] ? Number(match[3]) : 1;
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        valid = year >= 1000 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1];
      }
      if (!valid) fail(location, 'date', '请填写真实日期 YYYY-MM-DD 或仅精确到月的 YYYY-MM；未知日期请省略字段。');
    }
    if ('dateKind' in item && !['event', 'published'].includes(item.dateKind)) fail(location, 'dateKind', '只能填写 event（活动日期）或 published（发布日期）。');
    if ('dateKind' in item && !('date' in item)) fail(location, 'dateKind', '填写日期类型时也必须填写 date。');
  }
  for (const [index, person] of people.entries()) {
    const location = where('content/people.json', person, index);
    translations(person, location, { name: false });
    if (!groupIds.has(person.group)) fail(location, 'group', `未知成员分组 ${String(person.group)}；请使用 content/groups.json 中已有的 id。`);
    asset(person.image, location, 'image');
    if (person.profilePath !== null && person.profilePath !== undefined) {
      if (!isString(person.profilePath)) fail(location, 'profilePath', '应为个人主页的规范地址或 null。');
      else {
        let normalized;
        try { normalized = decodeURIComponent(person.profilePath).toLowerCase(); } catch { normalized = ''; }
        const profile = pageByPath.get(normalized);
        if (!profile || profile.type !== 'profile' || profile.path !== person.profilePath) fail(location, 'profilePath', '必须指向 content/pages.json 中 type 为 profile 的规范 path；没有个人页时填写 null。');
      }
    }
  }
  for (const [index, photo] of labLives.entries()) {
    const location = where('content/lab-lives.json', photo, index);
    translations(photo, location, { caption: false, alt: false });
    asset(photo.original, location, 'original');
    if ('display' in photo) asset(photo.display, location, 'display');
    if ('year' in photo && (!Number.isInteger(photo.year) || photo.year < 1000 || photo.year > 9999)) fail(location, 'year', '请填写已确认的四位数活动年份；未知时省略。');
    if (people.some(person => person.id === photo.id)) fail(location, 'id', '不能与成员 id 重复，两者出现在同一页面。');
  }
  for (const [index, project] of projects.entries()) {
    const location = where('content/research.json', project, index);
    translations(project, location, { title: false, descriptionHtml: true });
    images(project.images, location, { required: true });
  }
  for (const [index, publication] of publications.entries()) {
    const location = where('content/publications.json', publication, index);
    if (!Number.isInteger(publication.year) || publication.year < 1000 || publication.year > 9999) fail(location, 'year', '请填写四位数年份，例如 2026，不要加引号。');
    if (!['AIMI', 'Publications Before AIMI'].includes(publication.section)) fail(location, 'section', '只能填写 AIMI 或 Publications Before AIMI。');
    text(publication.html, location, 'html');
    text(publication.citation, location, 'citation（从 html 提取）');
    if (!Array.isArray(publication.links)) fail(location, 'links（从 html 提取）', '应为包含 url 的链接对象数组。');
    else for (const [linkIndex, link] of publication.links.entries()) {
      if (!isObject(link) || !isNonempty(link.url)) { fail(location, `links[${linkIndex}].url`, '链接地址不能为空。'); continue; }
      try { if (!['https:', 'http:'].includes(new URL(link.url).protocol)) throw new Error(); }
      catch { fail(location, `links[${linkIndex}].url`, '论文链接应为完整的 http 或 https 地址。'); }
    }
  }

  if (!isObject(data.ui)) fail('content/ui.json', '文件内容', '应为包含 en 和 zh 的对象。');
  else {
    for (const language of LANGUAGES) if (!isObject(data.ui[language])) fail('content/ui.json', language, '缺少界面语言对象。');
    const keys = new Set(LANGUAGES.flatMap(language => isObject(data.ui[language]) ? Object.keys(data.ui[language]) : []));
    for (const key of keys) for (const language of LANGUAGES) text(data.ui[language]?.[key], 'content/ui.json', `${language}.${key}`, { language });
  }
  if (isObject(data.home)) {
    for (const field of ['newsLimit', 'publicationLimit']) if (!Number.isInteger(data.home[field]) || data.home[field] < 1) fail('content/home.json', field, '应为大于 0 的整数。');
    if (!Array.isArray(data.home.hero) || !data.home.hero.length) fail('content/home.json', 'hero', '应为至少包含一张图片的轮播数组。');
    else for (const [index, image] of data.home.hero.entries()) {
      if (!isObject(image)) { fail('content/home.json', `hero[${index}]`, '应为轮播图片设置对象。'); continue; }
      for (const field of ['original', 'display']) asset(image[field], 'content/home.json', `hero[${index}].${field}`);
      for (const field of ['width', 'height']) if (!Number.isInteger(image[field]) || image[field] < 1) fail('content/home.json', `hero[${index}].${field}`, '应为大于 0 的像素数整数。');
      for (const field of ['altKey', 'captionKey']) if (!isNonempty(image[field]) || LANGUAGES.some(language => !isNonempty(data.ui?.[language]?.[image[field]]))) fail('content/home.json', `hero[${index}].${field}`, '应为 content/ui.json 中同时具有 en 和 zh 的文字键名。');
    }
    if (!Array.isArray(data.home.gallery)) fail('content/home.json', 'gallery', '应为图片对象数组。');
    else for (const [index, image] of data.home.gallery.entries()) {
      if (!isObject(image)) { fail('content/home.json', `gallery[${index}]`, '应为包含 url、altKey、captionKey 的对象。'); continue; }
      asset(image.url, 'content/home.json', `gallery[${index}].url`);
      for (const field of ['altKey', 'captionKey']) if (!isNonempty(image[field]) || LANGUAGES.some(language => !isNonempty(data.ui?.[language]?.[image[field]]))) fail('content/home.json', `gallery[${index}].${field}`, '应为 content/ui.json 中同时具有 en 和 zh 的文字键名。');
    }
  } else fail('content/home.json', '文件内容', '应为首页设置对象。');
  return errors;
}
