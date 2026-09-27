/** Homepage content and photos are configured in content/home.json and pages.json. */
export function renderHome(context) {
  const {
    pages,
    publications,
    home: homeContent,
    language,
    t,
    localized,
    pageUrl,
    esc,
    plain,
    html,
    localUrl,
    picture,
    straight,
    currentNews,
    currentProjects,
  } = context;
  const homePage = pages.find(page => page.type === 'home');

  function newsExcerpt(item) {
    const lead = item.bodyHtml
      .replace(/^\s*<h[1-6]>[\s\S]*?<\/h[1-6]>/, '')
      .split(/<\/p>|<h[1-6]>/)[0];
    const text = plain(lead).replace(item.title, '').trim();
    const limit = language === 'zh' ? 100 : 180;
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }

  const researchCards = currentProjects().map(project => `
    <a class="research-card" href="${pageUrl('/research/')}#${project.id}">
      <div class="research-image">${picture(project.images[0].url, project.title)}</div>
      <div class="research-card-copy">
        <h3>${esc(project.title)}</h3>
        <span class="text-link">${t('discoverProject')} ${straight}</span>
      </div>
    </a>`).join('');

  const newsCards = currentNews().slice(0, homeContent.newsLimit).map(item => {
    const image = item.images[0] ? `
      <a class="news-card-image" href="${pageUrl('/news/')}#${item.id}" aria-label="${esc(item.title)}">
        ${picture(item.images[0].url, '')}
      </a>` : '';

    return `<article class="news-card">
      ${image}
      <div class="news-card-copy">
        <h3><a href="${pageUrl('/news/')}#${item.id}">${esc(item.title)}</a></h3>
        <p>${esc(newsExcerpt(item))}</p>
        <a class="text-link" href="${pageUrl('/news/')}#${item.id}">${t('readStory')} ${straight}</a>
      </div>
    </article>`;
  }).join('');

  const publicationPreviews = publications.slice(0, homeContent.publicationLimit).map(publication => {
    const citation = html(publication.html);
    // A newly added paper may already contain a DOI or PDF link.
    const preview = publication.links.length
      ? citation
      : `<a href="${pageUrl('/publications/')}#${publication.id}">${citation}</a>`;
    return `
    <article class="publication-preview">
      <div class="pub-index">${publication.year}</div>
      <div lang="en">${preview}</div>
      <a class="publication-arrow" href="${pageUrl('/publications/')}#${publication.id}" aria-label="${esc(t('readPublication') + publication.citation)}">${straight}</a>
    </article>`;
  }).join('');

  const gallery = homeContent.gallery.map((image, index) => {
    const photo = picture(image.url, t(image.altKey));
    const visual = index === 0
      ? `<a href="${esc(localUrl(image.url))}">${photo}</a>`
      : photo;
    const caption = t(image.captionKey) + (index === 0 ? ' · ' + t('labName') : '');

    return `<figure>${visual}<figcaption>${caption}</figcaption></figure>`;
  }).join('');

  return `<main id="main">
    <section class="lab-intro" aria-labelledby="lab-welcome">
      <div class="wrap lab-intro-grid">
        <div class="lab-intro-copy">
          <p class="lab-affiliation">${t('institution')}<span>${t('institute')}</span></p>
          <h1 id="lab-welcome">${t('welcome')}</h1>
          <p class="lab-full-name">${t('fullName')}</p>
          <p class="lab-introduction">${t('intro')}</p>
          <a class="lab-more" href="#about">${t('aboutLab')} ${straight}</a>
        </div>
        <figure class="lab-intro-visual">
          <a href="${esc(homeContent.hero.original)}" aria-label="${t('viewTeamPhoto')}">
            <img src="${esc(homeContent.hero.display)}" alt="${t('teamPhotoAlt')}" width="${homeContent.hero.width}" height="${homeContent.hero.height}" fetchpriority="high">
          </a>
          <figcaption>
            <span>${t('labName')} · ${t('university')}</span>
            <a href="${pageUrl('/people/')}">${t('ourTeam')} ${straight}</a>
          </figcaption>
        </figure>
      </div>
    </section>
    <section class="section home-research">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <h2>${t('researchTitle')}</h2>
            <p class="section-description">${t('researchDescription')}</p>
          </div>
          <a class="text-link" href="${pageUrl('/research/')}">${t('allResearch')} ${straight}</a>
        </div>
        <div class="research-grid">${researchCards}</div>
      </div>
    </section>
    <section class="section home-updates">
      <div class="wrap updates-grid">
        <section class="updates-news" aria-labelledby="home-news-heading">
          <div class="section-heading">
            <h2 id="home-news-heading">${t('latestNews')}</h2>
            <a class="text-link" href="${pageUrl('/news/')}">${t('allNews')} ${straight}</a>
          </div>
          <div class="news-grid">${newsCards}</div>
        </section>
        <section class="updates-publications" aria-labelledby="home-publications-heading">
          <div class="section-heading">
            <h2 id="home-publications-heading">${t('publications')}</h2>
            <a class="text-link" href="${pageUrl('/publications/')}">${t('allPublications')} ${straight}</a>
          </div>
          ${publicationPreviews}
        </section>
      </div>
    </section>
    <section class="section soft" id="about">
      <div class="wrap">
        <div class="about-grid">
          <div>
            <h2>${t('aboutLab')}</h2>
            <a class="text-link about-link" href="${pageUrl('/people/')}">${t('meetPeople')} ${straight}</a>
          </div>
          <div class="prose">${html(localized('pages', homePage.id).html)}</div>
        </div>
        <div class="home-gallery">${gallery}</div>
      </div>
    </section>
  </main>`;
}
