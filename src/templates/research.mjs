function renderResearchFunds(context, funds) {
  const { esc, t } = context;
  const entries = funds.map(fund => `<li class="research-fund-entry" id="${esc(fund.id)}">
    <p class="research-fund-period"><time datetime="${esc(fund.start)}">${esc(fund.start.replace('-', '.'))}</time>–<time datetime="${esc(fund.end)}">${esc(fund.end.replace('-', '.'))}</time></p>
    <p class="research-fund-program">${esc(fund.program)}</p>
    <h3>${esc(fund.title)}</h3>
  </li>`).join('');

  return `<section class="research-funds" id="research-fund" aria-labelledby="research-fund-heading">
    <h2 id="research-fund-heading">${esc(t('researchFund'))}</h2>
    <div class="research-fund-columns" aria-hidden="true">
      <span>${esc(t('fundPeriod'))}</span><span>${esc(t('fundProgram'))}</span><span>${esc(t('fundProject'))}</span>
    </div>
    <ol class="research-fund-list" role="list">${entries}</ol>
  </section>`;
}

export function renderResearch(context) {
  const { esc, html, figure, t, currentProjects, currentResearchFunds } = context;
  const funds = currentResearchFunds();

  const projects = currentProjects().map(project => `<article class="project-entry" id="${project.id}">
    <h2>${esc(project.title)}</h2>
    <div class="prose">${project.images.map(image => figure(image.url, project.title)).join('')}${html(project.descriptionHtml)}</div>
  </article>`).join('');

  if (!funds.length) return projects;
  return `<nav class="research-nav" aria-label="${esc(t('researchSections'))}">
    <a href="#research-projects">${esc(t('researchTitle'))}</a>
    <a href="#research-fund">${esc(t('researchFund'))}</a>
  </nav>
  <div id="research-projects">${projects}</div>
  ${renderResearchFunds(context, funds)}`;
}
