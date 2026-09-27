export function renderResearch(context) {
  const { esc, html, figure, currentProjects } = context;

  return currentProjects().map(project => `<article class="project-entry" id="${project.id}">
    <h2>${esc(project.title)}</h2>
    <div class="prose">${project.images.map(image => figure(image.url, project.title)).join('')}${html(project.descriptionHtml)}</div>
  </article>`).join('');
}
