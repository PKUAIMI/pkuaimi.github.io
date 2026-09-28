(() => {
  function initializeLanguageSwitch() {
    const languageSwitch = document.querySelector('[data-language-switch]');
    if (!languageSwitch) return;

    const target = languageSwitch.getAttribute('href');
    function updateLanguageLink() {
      languageSwitch.href = target + location.hash;
    }

    updateLanguageLink();
    window.addEventListener('hashchange', updateLanguageLink);
    window.addEventListener('popstate', updateLanguageLink);
    window.addEventListener('aimi:sectionchange', updateLanguageLink);
  }

  function initializeNavigation(messages) {
    const toggle = document.querySelector('[data-menu-toggle]');
    const links = document.querySelector('[data-nav-links]');
    const desktop = window.matchMedia('(min-width: 901px)');

    function setOpen(open, restoreFocus = false) {
      if (!toggle || !links) return;

      toggle.setAttribute('aria-expanded', String(open));
      links.classList.toggle('is-open', open);
      const label = toggle.querySelector('[data-menu-label]');
      if (label) label.textContent = open ? messages.menuClose : messages.menu;
      if (restoreFocus) toggle.focus();
    }

    toggle?.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        setOpen(false, true);
      }
    });
    links?.addEventListener('click', event => {
      if (event.target.closest('a') && !desktop.matches) setOpen(false);
    });
    desktop.addEventListener('change', ({ matches }) => {
      const focusWasInNavigation = links?.contains(document.activeElement);
      setOpen(false, !matches && focusWasInNavigation);
    });

    return {
      toggle,
      close: () => setOpen(false),
    };
  }

  function initializeListFilters() {
    const filter = document.querySelector('[data-filter]');
    if (!filter) return;

    const input = filter.querySelector('input');
    const year = filter.querySelector('select');
    const items = [...document.querySelectorAll('[data-filter-item]')];
    const count = document.querySelector('[data-result-count]');
    const empty = document.querySelector('[data-empty]');
    const groups = document.querySelectorAll('[data-publication-group]');

    function updateResults() {
      const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let visible = 0;

      for (const item of items) {
        const text = item.textContent.toLocaleLowerCase();
        const matchesText = terms.every(term => text.includes(term));
        const matchesYear = !year || !year.value || item.dataset.year === year.value;
        const matches = matchesText && matchesYear;
        item.hidden = !matches;
        if (matches) visible++;
      }

      const resultLabel = visible === 1 ? filter.dataset.singular : filter.dataset.plural;
      count.textContent = `${visible} ${resultLabel}`;
      empty.hidden = visible !== 0;
      groups.forEach(group => {
        const groupItems = [...group.querySelectorAll('[data-filter-item]')];
        group.hidden = !groupItems.some(item => !item.hidden);
      });
    }

    input.addEventListener('input', updateResults);
    year?.addEventListener('change', updateResults);
    updateResults();
  }

  function initializeScrollableTables(messages) {
    document.querySelectorAll('.prose table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', messages.scrollableTable);
      table.before(wrapper);
      wrapper.append(table);
    });
  }

  function initializeCarousel(messages) {
    const carousel = document.querySelector('[data-carousel]');
    if (!carousel) return;
    const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
    if (slides.length < 2) return;

    const track = carousel.querySelector('[data-carousel-track]');
    const viewport = carousel.querySelector('[data-carousel-viewport]');
    const caption = carousel.querySelector('[data-carousel-caption]');
    const counter = carousel.querySelector('[data-carousel-counter]');
    const status = carousel.querySelector('[data-carousel-status]');
    const playButton = carousel.querySelector('[data-carousel-play]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let playing = !reducedMotion.matches;
    let hovered = false;
    let inView = true;
    let timer;
    let gesture;
    let suppressClickUntil = 0;

    function schedule() {
      clearTimeout(timer);
      if (!playing || hovered || !inView || document.hidden || document.querySelector('dialog[open]')) return;
      timer = setTimeout(() => {
        if (!document.querySelector('dialog[open]')) showSlide(index + 1);
        schedule();
      }, 6000);
    }

    function setPlaying(value) {
      playing = value;
      playButton.setAttribute('aria-label', playing ? messages.pauseSlideshow : messages.playSlideshow);
      playButton.querySelector('[data-carousel-pause-icon]').toggleAttribute('hidden', !playing);
      playButton.querySelector('[data-carousel-play-icon]').toggleAttribute('hidden', playing);
      schedule();
    }

    function showSlide(nextIndex, manual = false) {
      const focusWasOnPhoto = slides.some(slide => slide.contains(document.activeElement));
      index = (nextIndex + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((slide, slideIndex) => {
        slide.inert = slideIndex !== index;
        slide.setAttribute('aria-hidden', String(slideIndex !== index));
      });
      const label = slides[index].querySelector('figcaption').textContent;
      const position = messages.imagePosition.replace('{current}', index + 1).replace('{total}', slides.length);
      caption.textContent = label;
      counter.textContent = `${index + 1} / ${slides.length}`;
      counter.setAttribute('aria-label', position);
      if (manual) {
        setPlaying(false);
        status.textContent = `${position}: ${label}`;
        if (focusWasOnPhoto) slides[index].querySelector('a').focus({ preventScroll: true });
      }
    }

    carousel.querySelector('[data-carousel-controls]').hidden = false;
    carousel.classList.add('is-ready');
    carousel.querySelector('[data-carousel-previous]').addEventListener('click', () => showSlide(index - 1, true));
    carousel.querySelector('[data-carousel-next]').addEventListener('click', () => showSlide(index + 1, true));
    playButton.addEventListener('click', () => setPlaying(!playing));
    carousel.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      schedule();
    });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', event => {
      if (event.target !== playButton) setPlaying(false);
    });
    carousel.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        showSlide(index + (event.key === 'ArrowRight' ? 1 : -1), true);
      }
    });
    viewport.addEventListener('pointerdown', event => {
      gesture = event.pointerType === 'touch' && event.isPrimary
        ? { x: event.clientX, y: event.clientY } : null;
    });
    viewport.addEventListener('pointerup', event => {
      if (!gesture) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressClickUntil = Date.now() + 400;
        showSlide(index + (dx < 0 ? 1 : -1), true);
      }
    });
    viewport.addEventListener('pointercancel', () => { gesture = null; });
    viewport.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    document.addEventListener('visibilitychange', schedule);
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', schedule));
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) setPlaying(false);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        schedule();
      }).observe(carousel);
    }
    showSlide(0);
    setPlaying(playing);
  }

  function initializeImagePreview(messages, navigation) {
    const dialog = document.querySelector('[data-image-preview-dialog]');
    const main = document.querySelector('main');
    if (!main || !dialog || typeof dialog.showModal !== 'function') return;

    const media = dialog.querySelector('[data-preview-media]');
    const stage = dialog.querySelector('[data-preview-stage]');
    const status = dialog.querySelector('[data-preview-status]');
    const caption = dialog.querySelector('[data-preview-caption]');
    const original = dialog.querySelector('[data-preview-original]');
    const controls = dialog.querySelector('[data-preview-navigation]');
    const counter = dialog.querySelector('[data-preview-counter]');
    const closeButton = dialog.querySelector('[data-preview-close]');
    let gallery = [];
    let index = 0;
    let opener;
    let previousOverflow;
    let requestVersion = 0;
    let gesture;
    let suppressBackdropUntil = 0;

    function showImage(nextIndex) {
      index = (nextIndex + gallery.length) % gallery.length;
      const link = gallery[index];
      const thumbnail = link.querySelector('img');
      const figureCaption = link.closest('figure')?.querySelector('figcaption');
      const captionText = (figureCaption?.querySelector('[data-image-caption]') || figureCaption?.querySelector(':scope > span') || figureCaption)?.textContent;
      const label = captionText?.replace(/\s+/g, ' ').trim() || thumbnail.alt || link.getAttribute('aria-label') || '';
      const version = ++requestVersion;
      caption.textContent = label;
      original.href = link.href;
      controls.hidden = gallery.length < 2;
      counter.textContent = `${index + 1} / ${gallery.length}`;
      counter.setAttribute('aria-label', messages.imagePosition
        .replace('{current}', index + 1).replace('{total}', gallery.length));
      media.replaceChildren();
      media.setAttribute('aria-busy', 'true');
      status.textContent = messages.imageLoading;

      const image = new Image();
      image.alt = thumbnail.alt || label;
      image.decoding = 'async';
      image.draggable = false;
      image.addEventListener('load', () => {
        // Ignore a late image response after the visitor changes photos or closes.
        if (version !== requestVersion || !dialog.open) return;
        media.replaceChildren(image);
        media.setAttribute('aria-busy', 'false');
        status.textContent = '';
      });
      image.addEventListener('error', () => {
        if (version !== requestVersion || !dialog.open) return;
        media.setAttribute('aria-busy', 'false');
        status.textContent = messages.imageError;
      });
      image.src = link.href;
    }

    main.addEventListener('click', event => {
      const link = event.target.closest('a[data-image-preview]');
      if (!link || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const group = link.closest('.lab-lives-gallery, .lab-carousel, .home-gallery, .news-entry, .project-entry, .profile-content') || main;
      gallery = [...group.querySelectorAll('a[data-image-preview]')]
        .filter(candidate => candidate.getClientRects().length > 0);
      if (!gallery.includes(link)) return;
      event.preventDefault();
      opener = link;
      navigation.close();
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      showImage(gallery.indexOf(link));
      closeButton.focus({ preventScroll: true });
    });

    closeButton.addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-preview-previous]').addEventListener('click', () => showImage(index - 1));
    dialog.querySelector('[data-preview-next]').addEventListener('click', () => showImage(index + 1));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dialog.close();
      } else if (gallery.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        showImage(index + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'Tab') {
        const buttons = [...dialog.querySelectorAll('a[href], button')]
          .filter(element => element.getClientRects().length > 0);
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    dialog.addEventListener('click', event => {
      if (Date.now() < suppressBackdropUntil) return;
      if ([dialog, stage, media].includes(event.target)) dialog.close();
    });
    stage.addEventListener('pointerdown', event => {
      gesture = event.pointerType === 'touch' && event.isPrimary
        ? { x: event.clientX, y: event.clientY } : null;
    });
    stage.addEventListener('pointerup', event => {
      if (!gesture) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture = null;
      if (gallery.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressBackdropUntil = Date.now() + 400;
        showImage(index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener('pointercancel', () => { gesture = null; });
    dialog.addEventListener('close', () => {
      requestVersion++;
      gesture = null;
      suppressBackdropUntil = 0;
      media.replaceChildren();
      status.textContent = '';
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    });
  }

  function initializeSiteSearch({ language, messages, navigation }) {
    const dialog = document.querySelector('[data-search-dialog]');
    if (!dialog) return;

    const input = dialog.querySelector('input');
    const results = dialog.querySelector('[data-search-results]');
    const status = dialog.querySelector('[data-search-status]');
    const indexUrl = language === 'zh' ? '/zh/search-index.json' : '/search-index.json';
    let indexRequest;
    let opener;
    let previousOverflow;
    let searchVersion = 0;

    function loadSearchIndex() {
      // Share one request between searches, but allow a retry after a network error.
      if (!indexRequest) {
        indexRequest = fetch(indexUrl)
          .then(response => {
            if (!response.ok) throw new Error('Unable to load search');
            return response.json();
          })
          .catch(error => {
            indexRequest = undefined;
            throw error;
          });
      }
      return indexRequest;
    }

    function createSearchResult(item, firstTerm) {
      const result = document.createElement('li');
      const link = document.createElement('a');
      const title = document.createElement('strong');
      const snippet = document.createElement('span');
      const position = item.text.toLocaleLowerCase().indexOf(firstTerm);
      const start = Math.max(0, position - 45);
      const end = start + 180;

      link.href = item.url;
      title.textContent = item.title;
      snippet.textContent = (start ? '…' : '')
        + item.text.slice(start, end)
        + (item.text.length > end ? '…' : '');
      link.append(title, snippet);
      result.append(link);
      return result;
    }

    async function updateSearchResults() {
      const version = ++searchVersion;
      const query = input.value.trim().toLocaleLowerCase();
      results.replaceChildren();
      if (!query) {
        status.textContent = messages.searchHint;
        return;
      }
      status.textContent = messages.searching;

      let index;
      try {
        index = await loadSearchIndex();
      } catch {
        if (version === searchVersion) status.textContent = messages.searchError;
        return;
      }

      // A delayed response must never replace results for a more recent query.
      if (version !== searchVersion) return;
      const terms = query.split(/\s+/).filter(Boolean);
      const matches = index.filter(item => {
        const text = `${item.title} ${item.text}`.toLocaleLowerCase();
        return terms.every(term => text.includes(term));
      }).slice(0, 30);
      const resultLabel = matches.length === 1 ? messages.resultSingular : messages.resultPlural;
      status.textContent = matches.length
        ? `${matches.length} ${resultLabel}`
        : messages.searchEmpty;
      for (const item of matches) {
        results.append(createSearchResult(item, terms[0]));
      }
    }

    function openSearch(button) {
      if (dialog.open) return;

      opener = button;
      navigation.close();
      dialog.showModal();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      input.focus();
      loadSearchIndex().catch(() => {});
    }

    document.querySelectorAll('[data-search-open]').forEach(button => {
      button.addEventListener('click', () => openSearch(button));
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dialog.close();
      }
    });
    dialog.querySelector('[data-search-close]').addEventListener('click', () => {
      dialog.close();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;

      const bounds = dialog.getBoundingClientRect();
      const outsideDialog = event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom;
      if (outsideDialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      const target = opener?.getClientRects().length ? opener : navigation.toggle;
      target?.focus();
    });
    input.addEventListener('input', updateSearchResults);
  }

  document.documentElement.classList.remove('no-js');
  const language = document.documentElement.dataset.language;
  const messages = JSON.parse(document.getElementById('ui-messages').textContent);
  initializeLanguageSwitch();
  const navigation = initializeNavigation(messages);
  initializeListFilters();
  initializeScrollableTables(messages);
  initializeCarousel(messages);
  initializeImagePreview(messages, navigation);
  initializeSiteSearch({ language, messages, navigation });
})();
