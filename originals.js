(()=>{
 const songs=['Парень удалой','Казачка','Ласточка','Люли','Василёк','Неси меня река','Вольный ветер','Письмецо','Чужой','Вороны'];
 const listenLinks=window.NikaSiteConfig?.originalSongLinks||{};
 const history={
  'Парень удалой':{date:'16 октября 2026',datetime:'2026-10-16',description:'Релиз в сотрудничестве с музыкальным агентством «ПРО ПЕСНИ» и студией ND Media.'},
  'Казачка':{date:'31 июля 2026',datetime:'2026-07-31',description:'Премьера песни, которую мы отметили отдельным праздничным музыкальным эфиром.'},
  'Неси меня река':{date:'2024',datetime:'2024',description:'Музыка Вячеслава Титова, слова Аллы Говоровой, аранжировка Сергея Бахтина.',video:'https://www.youtube.com/watch?v=d12L4DfqzY4'},
  'Вороны':{date:'2023',datetime:'2023',description:'Одна из выпущенных в 2023 году авторских композиций.',video:'https://www.youtube.com/watch?v=SL_ZyD_ojHs'}
 };
 const clips=typeof shortsCatalog!=='undefined'?shortsCatalog.items:[];
 const grid=document.getElementById('original-grid');
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
 const link=(label,href,cls='original-button')=>{const a=el('a',cls,label);a.href=href;return a};
 for(const title of songs){
  const videos=clips.filter(c=>c.type==='original'&&c.song===title).sort((a,b)=>(b.views||0)-(a.views||0));
  const shortsURL='shorts.html?type=original&song='+encodeURIComponent(title);
  const card=el('article','original-card');const cover=videos.length?link('',shortsURL,'original-cover'):el('div','original-cover','♫');
  if(title==='Письмецо')card.id='pismetso';
  if(videos.length){cover.setAttribute('aria-label','Смотреть сниппеты песни '+title);cover.textContent='♫';const img=el('img');img.alt='';img.src=videos[0].thumbnail||'https://i.ytimg.com/vi/'+videos[0].id+'/hqdefault.jpg';img.loading='lazy';img.addEventListener('error',()=>img.remove());cover.append(img,el('span','original-play','▶'));}
  const copy=el('div','original-card-copy');copy.append(el('h3','',title),el('small','',videos.length?'Сниппеты: '+videos.length:'Можно заказать на эфире'));
  const info=history[title];if(info){const date=el('time','original-date',info.date);date.dateTime=info.datetime;copy.append(date,el('p','original-description',info.description));}
  const actions=el('div','original-card-actions');if(videos.length)actions.append(link('▶ Сниппеты',shortsURL));actions.append(link('♫ Заказать','songs.html?filter=original&q='+encodeURIComponent(title),'original-button primary'));
  if(listenLinks[title]){const listen=link('Слушать',listenLinks[title]);listen.target='_blank';listen.rel='noopener noreferrer';actions.append(listen);}
  if(info?.video){const video=link('Видео',info.video);video.target='_blank';video.rel='noopener noreferrer';actions.append(video);}
  copy.append(actions);card.append(cover,copy);grid.append(card);
 }
 if(location.hash==='#pismetso')requestAnimationFrame(()=>document.getElementById('pismetso')?.scrollIntoView({block:'center'}));
})();
