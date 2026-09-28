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

  const slides = homeContent.hero.map((image, index) => `
    <figure class="carousel-slide" data-carousel-slide role="group" aria-roledescription="${t('slide')}" aria-label="${index + 1} / ${homeContent.hero.length}">
      <a href="${esc(localUrl(image.original))}" aria-label="${esc(t('fullImage') + t(image.altKey))}">
        <img src="${esc(localUrl(image.display))}" alt="${t(image.altKey)}" width="${image.width}" height="${image.height}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ''}>
      </a>
      <figcaption class="sr-only">${t(image.captionKey)}</figcaption>
    </figure>`).join('');

  const gallery = homeContent.gallery.map(image => {
    const photo = picture(image.url, t(image.altKey));
    const visual = `<a href="${esc(localUrl(image.url))}">${photo}</a>`;
    const caption = t(image.captionKey);

    return `<figure>${visual}<figcaption>${caption}</figcaption></figure>`;
  }).join('');

  const chapters = [['home', 'storyHome'], ['updates', 'storyUpdates'], ['research', 'research'], ['about', 'aboutLab'], ['contact', 'contact']];

  return `<nav class="story-chapters" aria-label="${t('storyNavigation')}">
      <div class="wrap story-chapter-links">${chapters.map(([id, label], index) => `
        <a href="#${id}" data-story-link><span aria-hidden="true">0${index + 1}</span>${t(label)}</a>`).join('')}
      </div>
      <div class="story-progress" aria-hidden="true"><span data-story-progress></span></div>
    </nav>
    <main id="main" class="home-story">
    <section class="lab-intro story-section" id="home" data-story-section aria-labelledby="lab-welcome">
      <div class="story-atmosphere" aria-hidden="true"><span data-story-cloud></span><span data-story-cloud></span></div>
      <div class="wrap lab-intro-grid">
        <div class="lab-intro-copy" data-story-copy>
          <p class="lab-affiliation">${t('institution')}<span>${t('institute')}</span></p>
          <h1 id="lab-welcome">${t('welcome')}</h1>
          <p class="lab-full-name">${t('fullName')}</p>
          <p class="lab-introduction">${t('intro')}</p>
          <a class="lab-more" href="#about">${t('aboutLab')} ${straight}</a>
        </div>
        <div class="lab-intro-visual lab-carousel" data-carousel role="region" aria-roledescription="${t('carousel')}" aria-label="${t('teamGallery')}">
          <div class="carousel-viewport" data-carousel-viewport>
            <div class="carousel-track" data-carousel-track>${slides}</div>
          </div>
          <div class="carousel-footer">
            <div class="carousel-caption">
              <p data-carousel-caption>${t(homeContent.hero[0].captionKey)}</p>
              <a href="${pageUrl('/people/')}">${t('ourTeam')} ${straight}</a>
            </div>
            <div class="carousel-controls" data-carousel-controls hidden>
              <button type="button" data-carousel-previous aria-label="${t('imagePrevious')}">←</button>
              <span data-carousel-counter>1 / ${homeContent.hero.length}</span>
              <button type="button" data-carousel-next aria-label="${t('imageNext')}">→</button>
              <button type="button" data-carousel-play aria-label="${t('pauseSlideshow')}">
                <svg viewBox="0 0 20 20" aria-hidden="true"><path data-carousel-pause-icon d="M7 5v10M13 5v10" fill="none" stroke="currentColor" stroke-width="2"/><path data-carousel-play-icon d="m6 4 10 6-10 6Z" fill="currentColor" hidden/></svg>
              </button>
            </div>
          </div>
          <span class="sr-only" data-carousel-status aria-live="polite" aria-atomic="true"></span>
        </div>
      </div>
      <a class="story-next" href="#updates">${t('scrollToExplore')} <span aria-hidden="true">↓</span></a>
    </section>
    <section class="section home-updates story-section" id="updates" data-story-section aria-label="${t('storyUpdatesTitle')}">
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
    <section class="section home-research story-section" id="research" data-story-section aria-labelledby="story-research-heading">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <h2 id="story-research-heading">${t('researchTitle')}</h2>
            <p class="section-description">${t('researchDescription')}</p>
          </div>
          <a class="text-link" href="${pageUrl('/research/')}">${t('allResearch')} ${straight}</a>
        </div>
        <div class="research-grid">${researchCards}</div>
      </div>
    </section>
    <section class="section soft story-section" id="about" data-story-section aria-labelledby="story-about-heading">
      <div class="wrap">
        <div class="about-grid">
          <div class="about-heading">
            <h2 id="story-about-heading">${t('aboutLab')}</h2>
            <a class="text-link about-link" href="${pageUrl('/people/')}">${t('meetPeople')} ${straight}</a>
          </div>
          <div class="prose">${html(localized('pages', homePage.id).html)}</div>
          <div class="home-gallery">${gallery}</div>
        </div>
      </div>
    </section>
  </main>`;
}
