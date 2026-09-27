import { renderFilters } from './filters.mjs';

export function renderPublications(context) {
  const { publications, t, html } = context;
  const years = [...new Set(publications.map(publication => publication.year))]
    .filter(Boolean)
    .sort((a, b) => b - a);
  const groups = [...new Set(publications.map(publication => publication.section))];
  const sections = groups.map(group => {
    const items = publications
      .filter(publication => publication.section === group)
      .map(publication => `<article class="publication-item" data-filter-item data-year="${publication.year}" id="${publication.id}">
        <div class="pub-year">${publication.year || ''}</div>
        <div lang="en">${html(publication.html)}</div>
      </article>`)
      .join('');

    return `<section data-publication-group>
      <h2 class="publication-group">${t(group === 'AIMI' ? 'atAIMI' : 'beforeAIMI')}</h2>
      ${items}
    </section>`;
  }).join('');

  return renderFilters(context, 'publications', years) + sections;
}
