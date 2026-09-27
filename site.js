(() => {
  const menu = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav-links]');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    menu.querySelector('[data-menu-label]').textContent = open ? 'Close' : 'Menu';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      menu.click(); menu.focus();
    }
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', ({matches}) => {
    if (matches && menu?.getAttribute('aria-expanded') === 'true') menu.click();
  });

  const filter = document.querySelector('[data-filter]');
  if (filter) {
    const input = filter.querySelector('input');
    const year = filter.querySelector('select');
    const items = [...document.querySelectorAll('[data-filter-item]')];
    const count = document.querySelector('[data-result-count]');
    const empty = document.querySelector('[data-empty]');
    const update = () => {
      const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const item of items) {
        const text = item.textContent.toLocaleLowerCase();
        const matches = terms.every(term => text.includes(term)) && (!year || !year.value || item.dataset.year === year.value);
        item.hidden = !matches;
        if (matches) visible++;
      }
      count.textContent = `${visible} ${visible === 1 ? filter.dataset.singular : filter.dataset.plural}`;
      empty.hidden = visible !== 0;
      document.querySelectorAll('[data-publication-group]').forEach(group => {
        group.hidden = ![...group.querySelectorAll('[data-filter-item]')].some(item => !item.hidden);
      });
    };
    input.addEventListener('input', update);
    year?.addEventListener('change', update);
    update();
  }

  document.querySelectorAll('.prose table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');
    table.before(wrapper); wrapper.append(table);
  });

  const dialog = document.querySelector('[data-search-dialog]');
  if (!dialog) return;
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('[data-search-results]');
  const status = dialog.querySelector('[data-search-status]');
  let index;
  let indexRequest;
  let opener;
  const getIndex = () => {
    if (!indexRequest) indexRequest = fetch('/search-index.json')
      .then(response => { if (!response.ok) throw new Error('Unable to load search'); return response.json(); })
      .then(data => (index = data))
      .catch(error => {indexRequest = undefined; throw error;});
    return indexRequest;
  };
  const search = async () => {
    const query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (!query) {status.textContent = 'Search people, research, news and publications. 支持中文搜索。'; return;}
    status.textContent = 'Searching…';
    try { await getIndex(); } catch { status.textContent = 'Search could not load. Please try again, or use the main navigation.'; return; }
    if (query !== input.value.trim().toLocaleLowerCase()) return;
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = index.filter(item => terms.every(term => `${item.title} ${item.text}`.toLocaleLowerCase().includes(term))).slice(0,30);
    status.textContent = matches.length ? `${matches.length} results` : 'No matching results. Try another name or keyword.';
    for (const item of matches) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = item.url;
      const title = document.createElement('strong'); title.textContent = item.title;
      const snippet = document.createElement('span');
      const position = item.text.toLocaleLowerCase().indexOf(terms[0]);
      const start = Math.max(0,position - 45);
      snippet.textContent = (start ? '…' : '') + item.text.slice(start,start+180) + (item.text.length > start+180 ? '…' : '');
      a.append(title,snippet); li.append(a); results.append(li);
    }
  };
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', () => {
    opener = button;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    input.focus();
    getIndex().catch(() => {});
  }));
  dialog.addEventListener('keydown', event => {if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();dialog.close();}});
  dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {if(event.target === dialog) {const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close', () => {document.body.style.overflow = '';opener?.focus();});
  input.addEventListener('input', search);
})();
