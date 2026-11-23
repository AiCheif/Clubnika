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
    a.append(img,el('strong','',video.title||'Shorts'),el('small','',`${fmt(video.views)} просмотров`));return a;
  }
  async function init(){
    try {
      const response=await fetch('./remix-ranking.json',{cache:'no-cache'});if(!response.ok)throw new Error();
      const data=await response.json();const authors=data.authors||[],videos=data.videos||[],byId=new Map(videos.map(v=>[v.id,v]));
      $('rank-song').textContent=data.song;
      $('rank-videos').textContent=fmt(data.stats.videoCount);$('rank-authors').textContent=fmt(data.stats.authorCount);$('rank-views').textContent=fmt(data.stats.views);
      const best=[...videos].sort((a,b)=>(b.views??-1)-(a.views??-1))[0];
      if(best){$('rank-best').textContent=fmt(best.views);$('rank-best-link').href=videoURL(best.id);$('rank-best-link').hidden=false;}
      $('rank-updated').textContent=`Данные YouTube на ${new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeZone:'Europe/Moscow'}).format(new Date(data.updatedAt))}`;
      function render(){
        const sort=$('rank-sort').value,query=$('rank-search').value.trim().toLocaleLowerCase('ru');
        const ordered=[...authors].sort((a,b)=>(b[sort]??-1)-(a[sort]??-1)||(b.views??-1)-(a.views??-1)||a.channelId.localeCompare(b.channelId));
        const rows=[];
        ordered.forEach((author,index)=>{
          if(query&&!author.name.toLocaleLowerCase('ru').includes(query))return;
          const details=el('details','rank-row');const summary=el('summary','rank-summary');
          const placement=el('span',`rank-place${index<3?' podium':''}`,String(index+1));
          const identity=el('span','rank-identity');const copy=el('span','rank-name');copy.append(el('strong','',author.name),el('small','',`YouTube · ${author.channelId.slice(-6)}`));identity.append(avatar(author),copy);
          const metric=(label,value)=>{const b=el('span','rank-metric');b.append(el('small','',label),el('strong','',fmt(value)));return b;};
          summary.append(placement,identity,metric('Роликов',author.videoCount),metric('Просмотры',author.views),metric('Лайки',author.likes),el('span','rank-expand','⌄'));
          const body=el('div','rank-details');const actions=el('div','rank-actions');actions.append(link(channelURL(author.channelId),'Канал автора','outline'));
          if(author.bestVideoId)actions.append(link(videoURL(author.bestVideoId),'Лучший Shorts','outline'));
          body.append(actions);details.append(summary,body);
          details.addEventListener('toggle',()=>{if(!details.open||body.dataset.loaded)return;body.dataset.loaded='true';const grid=el('div','rank-clips');for(const id of author.videoIds||[]){const v=byId.get(id);if(v)grid.append(clip(v));}body.append(grid);});
          rows.push(details);
        });
        $('rank-list').replaceChildren(...rows);if(!rows.length)$('rank-list').append(el('p','empty','Авторы не найдены'));
        $('rank-count').textContent=`Авторов: ${rows.length} из ${authors.length}`;
      }
      $('rank-sort').addEventListener('change',render);$('rank-search').addEventListener('input',render);render();
    }catch{ $('rank-count').textContent='Не удалось загрузить рейтинг. Обновите страницу.'; }
  }
  init();
})();
