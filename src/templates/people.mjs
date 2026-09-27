export function renderPeople(context) {
  const { groups, t, esc, localUrl, picture, straight, currentPeople, groupLabel } = context;
  const members = currentPeople();
  const memberGroups = groups
    .map(group => group.id)
    .filter(groupId => members.some(member => member.group === groupId));

  return memberGroups.map((group, index) => {
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
}
