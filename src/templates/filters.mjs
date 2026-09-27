export function renderFilters(context, kind, years = []) {
  const { t, searchIcon } = context;
  const isPublications = kind === 'publications';
  const singular = t(isPublications ? 'publicationSingular' : 'newsSingular');
  const plural = t(isPublications ? 'publicationPlural' : 'newsPlural');
  const searchLabel = t(isPublications ? 'searchPublications' : 'searchNews');
  const placeholder = t(isPublications ? 'publicationsPlaceholder' : 'newsPlaceholder');
  const yearFilter = years.length ? `
    <label class="sr-only" for="year-filter">${t('publicationYear')}</label>
    <select id="year-filter">
      <option value="">${t('allYears')}</option>
      ${years.map(year => `<option value="${year}">${year}</option>`).join('')}
    </select>` : '';

  return `<div class="filter-bar" data-filter data-singular="${singular}" data-plural="${plural}">
    <div class="filter-field">
      ${searchIcon}
      <label class="sr-only" for="content-filter">${searchLabel}</label>
      <input id="content-filter" type="search" placeholder="${placeholder}">
    </div>
    ${yearFilter}
  </div>
  <p class="result-count" data-result-count aria-live="polite"></p>
  <p class="empty-state" data-empty hidden>${t('empty')}</p>`;
}
