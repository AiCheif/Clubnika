(() => {
  const grid = document.getElementById('shorts-grid');
  if (!grid || typeof shortsCatalog === 'undefined') return;
  const {items, updated} = shortsCatalog;
  const channelOrder = new Map((shortsCatalog.chronology || []).map((id,index)=>[id,index]));
  const newestFirst = (a,b) => (channelOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (channelOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  const countFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1});
  const formatViews = n => n >= 1000000 ? `${countFormat.format(n / 1000000)} млн` : n >= 1000 ? `${countFormat.format(n / 1000)} тыс.` : countFormat.format(n);
  const category = item => item.type === 'original' ? 'Авторская песня' : item.type === 'cover' ? 'Кавер' : 'Перевод песни';
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
    copy.append(make('span', 'short-category', category(item)), make('strong', '', item.song || item.title));
    if (item.song) copy.append(make('span', 'short-category', item.title));
    if (Number.isFinite(item.views)) copy.append(make('span', 'short-views', `${formatViews(item.views)} просмотров`));
    link.append(preview, copy);
    return link;
  }
  const filters = document.getElementById('shorts-filters');
  const search = document.getElementById('shorts-search');
  const sort = document.getElementById('shorts-sort');
  const count = document.getElementById('shorts-count');
  const songFilter = document.getElementById('shorts-song');
  const requested = new URLSearchParams(location.search).get('type');
  let filter = filters && ['original','cover','translation'].includes(requested) ? requested : 'all';
  let page = 1;
  const pageSize = 24;
  const byViews = (a,b) => (b.views ?? -1)-(a.views ?? -1);
  const popular = items.filter(item => Number.isFinite(item.views)).sort(byViews);
  const featured = popular.filter(item => item.type !== 'original').slice(0,4);
  const displayed = filters ? items : featured;
  const total = document.getElementById('shorts-total-number');
  const date = document.getElementById('shorts-updated');
  if (total) total.textContent = formatViews(displayed.reduce((sum,item) => sum+(Number.isFinite(item.views)?item.views:0),0));
  const heroViews=document.getElementById('hero-views');
  if(heroViews)heroViews.textContent=formatViews(items.reduce((sum,item)=>sum+(Number.isFinite(item.views)?item.views:0),0));
  const daily=document.getElementById('my-music');
  const songLinks=window.NikaSiteConfig?.originalSongLinks;
  if(heroViews&&daily&&songLinks){
    const songs=Object.keys(songLinks).filter(song=>items.some(i=>i.type==='original'&&i.song===song));
    if(songs.length){
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const dateParts=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const day=Math.floor(Date.UTC(+dateParts.year,+dateParts.month-1,+dateParts.day)/86400000);
      const song=songs[day%songs.length],item=items.filter(i=>i.type==='original'&&i.song===song).sort(byViews)[0];
      const link=make('a','daily-song');link.href=songLinks[song];link.target='_blank';link.rel='noopener noreferrer';
      const img=make('img');img.src=item.thumbnail||`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;img.alt='';img.loading='lazy';
      const text=make('span','daily-song-copy');text.append(make('small','','ПЕСНЯ ДНЯ'),make('strong','',song));
      link.append(img,text,make('span','daily-song-action','♪ Слушать'));
      daily.querySelector('#original-chips')?.before(link);
    }
  }
  if (date) date.textContent = `Просмотры по данным YouTube на ${updated}`;
  const pages = make('div', 'pages');
  if (filters) { pages.setAttribute('aria-label','Страницы каталога'); grid.after(pages); }
  if(songFilter){
    for(const song of [...new Set(items.map(i=>i.song).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'))){
      const option=make('option','',song);option.value=song;songFilter.append(option);
    }
    const requestedSong=new URLSearchParams(location.search).get('song');
    if(filter==='original'&&[...songFilter.options].some(option=>option.value===requestedSong))songFilter.value=requestedSong;
    songFilter.addEventListener('change',()=>{page=1;render();});
  }
  function syncFilters(){
    filters?.querySelectorAll('button').forEach(el=>{const active=el.dataset.filter===filter;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    if(songFilter){songFilter.closest('label').hidden=filter!=='original';if(filter!=='original')songFilter.value='';}
  }
  function render() {
    const query = (search?.value || '').trim().toLocaleLowerCase('ru');
    const result = displayed.filter(item => (filter === 'all' || item.type === filter) && (!songFilter?.value || item.song === songFilter.value) && `${item.title} ${item.song || ''} ${item.search || ''}`.toLocaleLowerCase('ru').includes(query));
    result.sort(sort?.value === 'newest' ? newestFirst : sort?.value === 'title' ? (a,b) => a.title.localeCompare(b.title,'ru') : byViews);
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
    syncFilters();
    render();
  });
  search?.addEventListener('input', () => {page=1;render();});
  sort?.addEventListener('change', () => {page=1;render();});
  syncFilters();
  render();
})();
