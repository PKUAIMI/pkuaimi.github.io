export function renderPeople(context) {
  const { groups, labLives, language, t, esc, localUrl, picture, straight, currentPeople, groupLabel } = context;
  const members = currentPeople();
  const memberGroups = groups
    .map(group => group.id)
    .filter(groupId => members.some(member => member.group === groupId));

  const memberSections = memberGroups.map((group, index) => {
    const cards = members.filter(member => member.group === group).map(person => {
      const url = person.profilePath ? localUrl(person.profilePath) : null;
      const tag = url ? 'a' : 'article';
      const profileLink = url
        ? `<span class="text-link">${t('viewProfile')} ${straight}</span>`
        : '';

      return `<${tag} class="person-card"${url ? ` href="${url}"` : ''} id="${person.id}">
        ${picture(person.image, person.name)}
        <div class="person-copy">
          <h3>${esc(person.name)}</h3>
          <p>${groupLabel(group)}</p>
          ${profileLink}
        </div>
      </${tag}>`;
    }).join('');

    return `<section class="people-group${group === 'faculty' ? ' faculty-group' : ''}" aria-labelledby="group-${index}">
      <h2 class="people-group-title" id="group-${index}">${groupLabel(group)}</h2>
      <div class="people-cards">${cards}</div>
    </section>`;
  }).join('');

  if (!labLives.length) return memberSections;
  const renderPhoto = photo => {
    const { caption, alt } = photo[language];
    return `<figure class="lab-life-photo" id="${esc(photo.id)}">
      <a class="lab-life-image" href="${esc(localUrl(photo.original))}" aria-label="${esc(t('fullImage') + caption)}">
        ${picture(photo.display || photo.original, alt)}
        <span class="lab-life-expand" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 5h5v5M10 19H5v-5M19 5l-6 6M5 19l6-6"/></svg></span>
      </a>
      <figcaption><span>${esc(caption)}</span></figcaption>
    </figure>`;
  };
  // Sort year groups newest first while preserving the editor's order within each year.
  const years = [...new Set(labLives.map(photo => photo.year ?? null))]
    .sort((a, b) => (b ?? 0) - (a ?? 0));
  const albums = years.map(year => {
    const heading = `lab-lives-year-${year ?? 'undated'}`;
    const photos = labLives.filter(photo => (photo.year ?? null) === year).map(renderPhoto).join('');
    return `<section class="lab-lives-year-group" aria-labelledby="${heading}">
      <h3 class="lab-lives-year-heading" id="${heading}">${year ?? t('labLivesUndated')}</h3>
      <div class="lab-lives-gallery">${photos}</div>
    </section>`;
  }).join('');

  return `${memberSections}
    <section class="lab-lives" id="lab-lives" aria-labelledby="lab-lives-heading">
      <div class="lab-lives-heading">
        <h2 class="people-group-title" id="lab-lives-heading">${t('labLives')}</h2>
        <p>${t('labLivesDescription')}</p>
      </div>
      ${albums}
    </section>`;
}
