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
  initializeSiteSearch({ language, messages, navigation });
})();
