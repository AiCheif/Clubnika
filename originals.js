(()=>{
 const songs=['Парень удалой','Казачка','Ласточка','Люли','Василёк','Неси меня река','Вольный ветер','Письмецо','Чужой','Вороны'];
 const clips=typeof shortsCatalog!=='undefined'?shortsCatalog.items:[];
 const grid=document.getElementById('original-grid');
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
 const link=(label,href,cls='original-button')=>{const a=el('a',cls,label);a.href=href;return a};
 for(const title of songs){
  const videos=clips.filter(c=>c.type==='original'&&c.song===title).sort((a,b)=>(b.views||0)-(a.views||0));
  const shortsURL='shorts.html?type=original&song='+encodeURIComponent(title);
  const card=el('article','original-card');const cover=videos.length?link('',shortsURL,'original-cover'):el('div','original-cover','♫');
  if(videos.length){cover.setAttribute('aria-label','Смотреть Shorts песни '+title);cover.textContent='♫';const img=el('img');img.alt='';img.src=videos[0].thumbnail||'https://i.ytimg.com/vi/'+videos[0].id+'/hqdefault.jpg';img.loading='lazy';img.addEventListener('error',()=>img.remove());cover.append(img,el('span','original-play','▶'));}
  const copy=el('div','original-card-copy');copy.append(el('h3','',title),el('small','',videos.length?'Shorts с этой песней: '+videos.length:'Можно заказать на эфире'));
  const actions=el('div','original-card-actions');if(videos.length)actions.append(link('▶ Смотреть',shortsURL));actions.append(link('♫ Заказать','songs.html?filter=original&q='+encodeURIComponent(title),'original-button primary'));
  if(title==='Парень удалой'){const listen=link('Слушать','https://band.link/paren_ydaloi');listen.target='_blank';listen.rel='noopener noreferrer';actions.append(listen);}
  copy.append(actions);card.append(cover,copy);grid.append(card);
 }
})();
