(() => {
  const grid = document.getElementById('shorts-grid');
  if (!grid || typeof shortsCatalog === 'undefined') return;
  const {items, updated} = shortsCatalog;
  const countFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1});
  const formatViews = n => n >= 1000000 ? `${countFormat.format(n / 1000000)} млн` : n >= 1000 ? `${countFormat.format(n / 1000)} тыс.` : countFormat.format(n);
  const category = item => item.type === 'cover' ? 'Кавер' : 'Перевод песни';
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  function card(item) {
    const link = make('a', 'short-card');
    link.href = `https://www.youtube.com/shorts/${item.id}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    const preview = make('span', 'short-preview');
    const img = make('img');
    const fallback = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
    img.src = item.thumbnail || fallback;
    img.addEventListener('error', () => { if (img.src !== fallback) img.src = fallback; }, {once:true});
    img.alt = ''; img.loading = 'lazy';
    const play = make('span', 'short-play', '▶');
    play.setAttribute('aria-hidden', 'true');
    preview.append(img, make('span', 'short-badge', 'Shorts'), play);
    const copy = make('span', 'short-copy');
    copy.append(make('span', 'short-category', category(item)), make('strong', '', item.title), make('span', 'short-views', `${formatViews(item.views)} просмотров`));
    link.append(preview, copy);
    return link;
  }
  const filters = document.getElementById('shorts-filters');
  const search = document.getElementById('shorts-search');
  const sort = document.getElementById('shorts-sort');
  const count = document.getElementById('shorts-count');
  let filter = 'all';
  let page = 1;
  const pageSize = 24;
  const popular = [...items].sort((a,b) => b.views-a.views);
  const featured = popular.slice(0,4);
  const displayed = filters ? items : featured;
  const total = document.getElementById('shorts-total-number');
  const date = document.getElementById('shorts-updated');
  if (total) total.textContent = formatViews(displayed.reduce((sum,item) => sum+item.views,0));
  if (date) date.textContent = `Просмотры по данным YouTube на ${updated}`;
  const pages = make('div', 'pages');
  if (filters) { pages.setAttribute('aria-label','Страницы каталога'); grid.after(pages); }
  function render() {
    const query = (search?.value || '').trim().toLocaleLowerCase('ru');
    const result = displayed.filter(item => (filter === 'all' || item.type === filter) && `${item.title} ${item.search || ''}`.toLocaleLowerCase('ru').includes(query));
    result.sort(sort?.value === 'title' ? (a,b) => a.title.localeCompare(b.title,'ru') : (a,b) => b.views-a.views);
    const maxPage = Math.max(1, Math.ceil(result.length / pageSize));
    page = Math.min(page,maxPage);
    grid.replaceChildren(...result.slice((page-1)*pageSize,page*pageSize).map(card));
    if (!result.length) grid.append(make('p','empty','Ничего не найдено. Попробуйте изменить запрос.'));
    if (count) count.textContent = `Найдено: ${result.length} из ${items.length}`;
    if (filters) {
      pages.replaceChildren();
      pages.hidden = maxPage <= 1;
      const go = (label,n,disabled=false) => {
        const button = make('button',n === page ? 'current' : '',label);
        button.type = 'button'; button.disabled = disabled;
        if (n === page) button.setAttribute('aria-current','page');
        button.addEventListener('click',() => { page=n; render(); grid.scrollIntoView({block:'start'}); });
        return button;
      };
      pages.append(go('‹',page-1,page===1));
      for(let n=1;n<=maxPage;n++) pages.append(go(String(n),n));
      pages.append(go('›',page+1,page===maxPage));
    }
  }
  filters?.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    page = 1;
    filters.querySelectorAll('button').forEach(el => { el.classList.toggle('active', el === button); el.setAttribute('aria-pressed', String(el === button)); });
    render();
  });
  search?.addEventListener('input', () => {page=1;render();});
  sort?.addEventListener('change', () => {page=1;render();});
  render();
})();
