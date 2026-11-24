(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => n == null ? '—' : new Intl.NumberFormat('ru-RU').format(n);
  const el = (tag, cls, text) => { const node=document.createElement(tag); if(cls)node.className=cls; if(text!=null)node.textContent=text; return node; };
  const channelURL = id => `https://www.youtube.com/channel/${id}`;
  const videoURL = id => `https://www.youtube.com/shorts/${id}`;
  const link = (url, label, cls) => { const a=el('a',cls,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a; };
  function avatar(author) {
    const wrap=el('span','rank-avatar',author.name?.trim().slice(0,1)||'♪');
    if(author.avatar?.startsWith('https://')) { const image=el('img');image.src=author.avatar;image.alt='';image.loading='lazy';image.addEventListener('error',()=>image.remove());wrap.append(image); }
    return wrap;
  }
  function clip(video) {
    const a=link(videoURL(video.id),'','rank-clip');const img=el('img');img.src=video.thumbnail?.startsWith('https://')?video.thumbnail:`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;img.alt='';img.loading='lazy';
    a.append(img,el('strong','',video.title||'Shorts'));
    if(video.authorName)a.append(el('small','',video.authorName));
    if(Number.isFinite(Date.parse(video.publishedAt)))a.append(el('small','',new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeZone:'Europe/Moscow'}).format(new Date(video.publishedAt))));
    const metric=(label,value)=>{const row=el('small','rank-video-metric');row.append(el('span','',label),el('b','',value));a.append(row);};
    metric('Просмотры',fmt(video.views));metric('За 7 дней',fmt(video.views7d));metric('В сутки',fmt(video.viewsPerDay==null?null:Math.round(video.viewsPerDay)));metric('Лайки',fmt(video.likes));metric('Лайки / просмотры',video.likeRate==null?'—':`${video.likeRate.toLocaleString('ru-RU',{maximumFractionDigits:2})}%`);return a;
  }
  function mergeAuthors(original, groups, byId) {
    const channels=new Map(original.map(a=>[a.channelId,a]));
    const claimed=new Set(), merged=[];
    for(const group of groups||[]){
      const ids=[...new Set(group.channelIds||[])];
      if(!ids.length || ids.some(id=>claimed.has(id)))continue;
      const members=ids.map(id=>channels.get(id)).filter(Boolean);
      if(!members.length)continue;
      ids.forEach(id=>claimed.add(id));
      const primary=members.find(a=>a.channelId===group.primaryChannelId)||members[0];
      const videoIds=[...new Set(members.flatMap(a=>a.videoIds||[]))].filter(id=>byId.has(id));
      videoIds.sort((a,b)=>(byId.get(b).views??-1)-(byId.get(a).views??-1)||a.localeCompare(b));
      const sum=key=>{const known=videoIds.map(id=>byId.get(id)[key]).filter(n=>typeof n==='number');return known.length?known.reduce((a,b)=>a+b,0):null;};
      merged.push({...primary,name:group.name||primary.name,channelIds:members.map(a=>a.channelId),videoIds,videoCount:videoIds.length,views:sum('views'),likes:sum('likes'),bestVideoId:videoIds.find(id=>byId.get(id).views!=null)||null});
    }
    return [...merged,...original.filter(a=>!claimed.has(a.channelId)).map(a=>({...a,channelIds:[a.channelId]}))];
  }
  async function init(){
    try {
      const registryResponse=await fetch('./remix-projects.json',{cache:'no-cache'});if(!registryResponse.ok)throw new Error('projects');
      const registry=await registryResponse.json(),projects=registry.projects||[];
      const requested=new URLSearchParams(location.search).get('song');
      const project=projects.find(p=>p.id===requested)||projects.find(p=>p.id===registry.defaultProject)||projects[0];
      if(!project)throw new Error('project');
      $('rank-song').textContent=project.title;
      for(const item of projects){
        const card=el('a','rank-project');card.href=`remixes.html?song=${encodeURIComponent(item.id)}`;
        if(item.id===project.id)card.setAttribute('aria-current','page');
        const cover=el('span','rank-project-cover','♫');
        if(item.coverVideoId){const img=el('img');img.src=`https://i.ytimg.com/vi/${encodeURIComponent(item.coverVideoId)}/hqdefault.jpg`;img.alt='';img.addEventListener('error',()=>img.remove());cover.replaceChildren(img);}
        const copy=el('span');copy.append(el('strong','',item.title),el('small','',item.shortsVideoId?'Ролики зрителей':'Готовится к запуску'));card.append(cover,copy);$('rank-projects').append(card);
      }
      if(project.shortsVideoId){$('rank-create').href=videoURL(project.shortsVideoId);$('rank-create').hidden=false;}
      const response=await fetch(`./${project.ranking}`,{cache:'no-cache'});if(!response.ok)throw new Error('ranking');
      const data=await response.json();const videos=data.videos||[],byId=new Map(videos.map(v=>[v.id,v]));
      let groups=[];
      try{const response=await fetch('./authors.json',{cache:'no-cache'});if(response.ok)groups=(await response.json()).authors||[];}catch{}
      const authors=mergeAuthors(data.authors||[],groups,byId);
      let snapshots=[];
      try{const response=await fetch(`./${project.history}`,{cache:'no-cache'});if(response.ok)snapshots=(await response.json()).snapshots||[];}catch{}
      const names=new Map(authors.flatMap(a=>a.channelIds.map(id=>[id,a.name])));
      for(const v of videos)Object.assign(v,remixMetrics.calculate(v,data.updatedAt,snapshots),{authorName:names.get(v.channelId)});
      const newest=[...videos].filter(v=>Number.isFinite(Date.parse(v.publishedAt))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id));
      $('rank-new-list').replaceChildren(...newest.slice(0,8).map(clip));
      $('rank-new-section').hidden=!newest.length;
      $('rank-song').textContent=project.title;
      $('rank-videos').textContent=fmt(data.stats?.videoCount??videos.length);$('rank-authors').textContent=fmt(authors.length);$('rank-views').textContent=fmt(data.stats?.views??0);
      const best=[...videos].sort((a,b)=>(b.views??-1)-(a.views??-1))[0];
      if(best){$('rank-best').textContent=fmt(best.views);$('rank-best-link').href=videoURL(best.id);$('rank-best-link').hidden=false;$('rank-best-label').hidden=true;}
      $('rank-updated').textContent=Number.isFinite(Date.parse(data.updatedAt))?`Данные YouTube на ${new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeZone:'Europe/Moscow'}).format(new Date(data.updatedAt))}`:'Статистика появится после публикации первых роликов.';
      let mode='new',page=1;
      const videoOptions=[['views','По просмотрам'],['views7d','За 7 дней'],['viewsPerDay','По просмотрам в сутки'],['likes','По лайкам'],['likeRate','По доле лайков']];
      const options={authors:videoOptions,videos:videoOptions};
      const compareVideos=(a,b,sort)=>(b[sort]??-1)-(a[sort]??-1)||(b.views??-1)-(a.views??-1)||a.id.localeCompare(b.id);
      function renderVideos(){
        const sort=$('rank-sort').value,query=$('rank-search').value.trim().toLocaleLowerCase('ru');
        const ordered=[...videos].filter(v=>`${v.title||''} ${v.authorName||''}`.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>(b[sort]??-1)-(a[sort]??-1)||(b.views??-1)-(a.views??-1)||a.id.localeCompare(b.id));
        const size=24,total=Math.max(1,Math.ceil(ordered.length/size));page=Math.min(page,total);
        const grid=el('div','rank-clips rank-video-grid');for(const v of ordered.slice((page-1)*size,page*size))grid.append(clip(v));
        $('rank-list').replaceChildren(ordered.length?grid:el('p','empty','Ролики не найдены'));
        $('rank-count').textContent=`Роликов: ${ordered.length} из ${videos.length}`;
        const pager=$('rank-pagination');pager.hidden=total<=1;pager.replaceChildren();
        for(const [label,delta] of [['← Назад',-1],['Далее →',1]]){const button=el('button','outline',label);button.disabled=page+delta<1||page+delta>total;button.addEventListener('click',()=>{page+=delta;renderVideos();$('rank-count').scrollIntoView({block:'nearest'});});pager.append(button);if(delta===-1)pager.append(el('span','',`${page} / ${total}`));}
      }
      function switchMode(next){
        mode=next;page=1;$('rank-search').value='';
        for(const key of ['new','authors','videos'])$('rank-mode-'+key).setAttribute('aria-pressed',String(key===mode));
        $('rank-new-section').hidden=mode!=='new';
        $('rank-catalog-section').hidden=mode==='new';
        if(mode==='new'){if(!newest.length)$('rank-new-list').replaceChildren(el('p','rank-empty',videos.length?'Новые ролики не найдены':'Пока здесь нет роликов. Совсем скоро появятся ваши видео под эту песню!'));return;}
        $('rank-heading').textContent=mode==='authors'?'Авторы':'Рейтинг роликов';
        $('rank-description').textContent=mode==='authors'?'Авторы расположены по алфавиту. Сортировка меняет порядок роликов внутри каждого автора.':'Просмотры в сутки — среднее с публикации (минимум одни сутки). За 7 дней — по снимкам статистики; для новых роликов — все просмотры. Пропуск означает отсутствие данных.';
        $('rank-search').placeholder=mode==='authors'?'Найти автора':'Найти ролик или автора';$('rank-search').setAttribute('aria-label',$('rank-search').placeholder);
        $('rank-sort').replaceChildren(...options[mode].map(([value,label])=>{const o=el('option','',label);o.value=value;return o;}));render();
      }
      function render(){
        if(mode==='videos'){renderVideos();return;}
        $('rank-pagination').hidden=true;
        const sort=$('rank-sort').value,query=$('rank-search').value.trim().toLocaleLowerCase('ru');
        const ordered=[...authors].sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'})||a.channelId.localeCompare(b.channelId));
        const opened=new Set([...$('rank-list').querySelectorAll('details[open]')].map(row=>row.dataset.channel));
        const rows=[];
        ordered.forEach((author,index)=>{
          if(query&&!author.name.toLocaleLowerCase('ru').includes(query))return;
          const details=el('details','rank-row');const summary=el('summary','rank-summary');
          details.dataset.channel=author.channelId;
          const identity=el('span','rank-identity');const copy=el('span','rank-name');copy.append(el('strong','',author.name),el('small','',author.channelIds.length>1?`YouTube · ${author.channelIds.length} канала`:`YouTube · ${author.channelId.slice(-6)}`));identity.append(avatar(author),copy);
          summary.append(identity,el('span','rank-expand','⌄'));
          const body=el('div','rank-details');const actions=el('div','rank-actions');author.channelIds.forEach((id,i)=>actions.append(link(channelURL(id),author.channelIds.length>1?`Канал ${i+1}`:'Канал автора','outline')));
          if(author.bestVideoId)actions.append(link(videoURL(author.bestVideoId),'Лучший Shorts','outline'));
          body.append(actions);details.append(summary,body);
          const loadClips=()=>{if(!details.open||body.dataset.loaded)return;body.dataset.loaded='true';const grid=el('div','rank-clips');for(const v of (author.videoIds||[]).map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>compareVideos(a,b,sort)))grid.append(clip(v));body.append(grid);};
          details.addEventListener('toggle',loadClips);
          if(opened.has(author.channelId)){details.open=true;loadClips();}
          rows.push(details);
        });
        $('rank-list').replaceChildren(...rows);if(!rows.length)$('rank-list').append(el('p','empty','Авторы не найдены'));
        $('rank-count').textContent=`Авторов: ${rows.length} из ${authors.length}`;
      }
      $('rank-sort').addEventListener('change',()=>{page=1;render();});$('rank-search').addEventListener('input',()=>{page=1;render();});$('rank-mode-new').addEventListener('click',()=>switchMode('new'));$('rank-mode-authors').addEventListener('click',()=>switchMode('authors'));$('rank-mode-videos').addEventListener('click',()=>switchMode('videos'));switchMode('new');
    }catch{ const error=$('rank-load-error');error.textContent='Не удалось загрузить рейтинг. Обновите страницу.';error.hidden=false;$('rank-count').textContent=error.textContent; }
  }
  init();
})();
