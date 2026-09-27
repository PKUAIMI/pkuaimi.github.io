import { renderFilters } from './filters.mjs';

export function renderNews(context) {
  const { t, esc, plain, html, figure, currentNews } = context;
  const entries = currentNews().map((item, index) => {
    const body = item.bodyHtml.replace(
      /^\s*<h[1-6]>([\s\S]*?)<\/h[1-6]>/,
      (heading, title) => plain(title) === item.title ? '' : heading,
    );
    const pictures = (item.images || []).filter(image => !body.includes(image.url));
    const gallery = pictures.length
      ? `<div class="news-gallery">${pictures.map(image => figure(image.url, item.title)).join('')}</div>`
      : '';
    const bodyWithConsistentHeadings = body
      .replace(/<h[2-6]>/g, '<h3>')
      .replace(/<\/h[2-6]>/g, '</h3>');

    return `<article class="news-entry" id="${item.id}" data-filter-item>
      <span class="entry-number">${t('newsLabel')} <span aria-hidden="true"> / </span> ${String(index + 1).padStart(2, '0')}</span>
      <h2>${esc(item.title)}</h2>
      <div class="prose">${html(bodyWithConsistentHeadings)}${gallery}</div>
    </article>`;
  }).join('');

  return renderFilters(context, 'news') + entries;
}
