/* Shared platform sections, footer and floating comment action. */
/* удаленые <option value="emerald">Изумрудная</option><option value="sapphire">Сапфировая</option><option value="turquoise">Бирюзовая</option> */
(()=>{
  const config=window.NikaSiteConfig,script=document.currentScript,main=document.querySelector('main');
  if(!config||!main)return;
  const headingOverrides={'stream-platforms':{label:'ПРЯМЫЕ ТРАНСЛЯЦИИ',title:'Жду вас в эфире'}};
  const renderSection=section=>{
    const meta=headingOverrides[section.id]||section;
    return `<section class="feature-section site-platforms" id="${section.id}"><div class="sectionhead"><div><div class="eyebrow">${meta.label}</div><h2>${meta.title}</h2></div></div><div class="platform-grid">${section.links.map(link=>`<a class="platform-link" href="${link.href}" ${link.attrs}>${link.html}</a>`).join('')}</div>${section.id==='stream-platforms'?'<p class="platform-schedule"><strong>Обычное расписание:</strong> вторник и суббота в 19:30 (МСК)</p>':''}</section>`;
  };
  const paired=config.platforms.filter(section=>['stream-platforms','listen'].includes(section.id));
  const others=config.platforms.filter(section=>!paired.includes(section));
  const markup=`<div class="site-platform-pair">${paired.map(renderSection).join('')}</div>${others.map(renderSection).join('')}`;
  const showPlatforms=!script.hasAttribute('data-hide-platforms');
  if(showPlatforms)main.insertAdjacentHTML('beforeend',markup);
  script.insertAdjacentHTML('beforebegin',`<footer class="wrap"><span class="footer-brand"><span class="emoji">🍓</span> Ника Моисеева</span><span>С любовью к музыке · <a href="${config.sourceCatalog}" target="_blank" rel="noopener">Полный список песен</a></span><div class="footer-settings"><label class="theme-picker" for="theme-picker">Тема: 
    <select id="theme-picker" aria-label="Тема сайта">
    <option value="scarlet">Алое золото</option><option value="berry">Клубничная</option><option value="winter">Зимняя сказка</option><option value="lavender">Лавандовая</option><option value="honey">Медовая</option><option value="lime">Лаймовая</option><option value="coral">Коралловая</option></select></label></div></footer>`);

  if(!script.hasAttribute('data-hide-comment')){
    const FALLBACK_MENU={
      enabled:true,
      showAfterScroll:300,
      label:'Меню Клубнички',
      mascot:{image:'img/logo-ruby.png',video:'',alt:'Клубничка'},
      items:[
        {enabled:true,title:'Заказать песню',href:'songs.html',icon:'🎵'},
        {enabled:true,title:'Оставить комментарий',href:'support.html',anchorOnPage:'#comment-section',icon:'💌'}
      ]
    };

    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeHref=raw=>{
      if(typeof raw!=='string')return null;
      const val=raw.trim();
      if(!val||/^(javascript|data|vbscript):/i.test(val))return null;
      return val;
    };

    const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
    const isAnimOff=()=>document.documentElement.dataset.anim==='off'||(!document.documentElement.dataset.anim&&reducedQuery.matches);
    const isSafari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    script.insertAdjacentHTML('beforebegin',`
      <div class="mascot-dock is-hidden" id="mascot-dock">
        <div class="mascot-popover" id="mascot-popover" role="menu" hidden></div>
        <button type="button" class="mascot-trigger" id="mascot-trigger" aria-expanded="false" aria-controls="mascot-popover" aria-label="Открыть меню">
          <span class="mascot-media" id="mascot-media"></span>
          <span class="mascot-label" id="mascot-label">Меню</span>
        </button>
      </div>
    `);

    const dock=document.getElementById('mascot-dock');
    const trigger=document.getElementById('mascot-trigger');
    const popover=document.getElementById('mascot-popover');
    const mediaBox=document.getElementById('mascot-media');
    const labelBox=document.getElementById('mascot-label');

    let isOpen=false;
    let videoEl=null;
    let scrollThreshold=FALLBACK_MENU.showAfterScroll;

    const update=()=>{
      if(isOpen)return;
      const show=window.scrollY>=scrollThreshold;
      dock.classList.toggle('is-hidden',!show);
    };

    const setOpen=next=>{
      isOpen=Boolean(next);
      trigger.setAttribute('aria-expanded',String(isOpen));
      popover.hidden=!isOpen;
      dock.classList.toggle('is-open',isOpen);
    };

    const syncPlayback=()=>{
      if(!videoEl)return;
      if(isAnimOff()||document.hidden){
        videoEl.pause();
      }else{
        videoEl.play().catch(()=>{});
      }
    };

    const renderMenu=cfg=>{
      const items=(Array.isArray(cfg?.items)?cfg.items:[]).filter(it=>it&&it.enabled!==false&&it.title);
      if(!cfg||cfg.enabled===false||!items.length){
        dock.remove();
        return;
      }

      const rawScroll=Number(cfg.showAfterScroll);
      scrollThreshold=Number.isFinite(rawScroll)?Math.max(0,rawScroll):FALLBACK_MENU.showAfterScroll;

      if(cfg.label){
        labelBox.textContent=cfg.label;
        trigger.setAttribute('aria-label',cfg.label);
      }

      const m=cfg.mascot||{};
      const imgSrc=safeHref(m.image);
      const vidSrc=safeHref(m.video);

      if(vidSrc&&!isSafari){
        mediaBox.innerHTML=`<video autoplay loop muted playsinline ${imgSrc?`poster="${esc(imgSrc)}"`:''} aria-hidden="true"><source src="${esc(vidSrc)}" type="video/webm"></video>`;
        videoEl=mediaBox.querySelector('video');
        syncPlayback();
      }else if(imgSrc){
        mediaBox.innerHTML=`<img src="${esc(imgSrc)}" alt="${esc(m.alt||'')}" width="64" height="64">`;
      }

      popover.innerHTML=items.map(item=>{
        let href=safeHref(item.href)||'#';
        const pageAnchor=safeHref(item.anchorOnPage);
        if(pageAnchor&&pageAnchor.startsWith('#')&&document.querySelector(pageAnchor)){
          href=pageAnchor;
        }
        const external=/^https?:\/\//i.test(href);
        return `
          <a class="mascot-item" role="menuitem" href="${esc(href)}"${external?' target="_blank" rel="noopener noreferrer"':''}>
            ${item.icon?`<span class="mascot-item-icon" aria-hidden="true">${esc(item.icon)}</span>`:''}
            <span class="mascot-item-body">
              <span class="mascot-item-title">${esc(item.title)}${item.badge?`<span class="mascot-item-badge">${esc(item.badge)}</span>`:''}</span>
              ${item.subtitle?`<small class="mascot-item-sub">${esc(item.subtitle)}</small>`:''}
            </span>
          </a>
        `;
      }).join('');

      update();
    };

    trigger.addEventListener('click',()=>setOpen(!isOpen));

    document.addEventListener('click',e=>{
      if(isOpen&&!dock.contains(e.target))setOpen(false);
    });

    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&isOpen){
        setOpen(false);
        trigger.focus();
      }
    });

    popover.addEventListener('click',e=>{
      if(e.target.closest('a'))setOpen(false);
    });

    document.addEventListener('visibilitychange',syncPlayback);
    document.addEventListener('clubnika:animchange',syncPlayback);

    addEventListener('scroll',update,{passive:true});
    addEventListener('resize',update);
    addEventListener('pageshow',update);
    requestAnimationFrame(update);

    fetch('./floating-menu.json')
      .then(r=>(r.ok?r.json():FALLBACK_MENU))
      .then(renderMenu)
      .catch(()=>renderMenu(FALLBACK_MENU));
  }

  if(main.querySelector('[data-live-platform]')&&!document.getElementById('watch-youtube')){
    const allowed={youtube:['youtube.com','youtu.be'],twitch:['twitch.tv'],vkLive:['vkvideo.ru','vk.ru','vk.com']};
    const links=[...main.querySelectorAll('[data-live-platform]')];const defaults=new Map(links.map(link=>[link,link.href]));
    function safe(value,key){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed[key].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch{return null}}
    async function refresh(){try{const response=await fetch('./live.json',{cache:'no-store'});if(!response.ok)return;const data=await response.json(),live=data.status==='live'&&Date.parse(data.liveUntil)>Date.now();for(const link of links)link.href=(live?safe(data.links?.[link.dataset.livePlatform],link.dataset.livePlatform):null)||defaults.get(link)}catch{}}
    refresh();setInterval(refresh,60000);
  }

  const quoteSource=document.getElementById('quote-source');
  if(quoteSource){
    let busy=false,lastRaw='';
    const buildBadge=()=>{
      const tag=document.createElement('span');
      tag.className='quote-platform-tag';
      tag.setAttribute('aria-hidden','true');
      const svgNS='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(svgNS,'svg');
      svg.setAttribute('viewBox','0 0 24 24');
      const rect=document.createElementNS(svgNS,'rect');
      rect.setAttribute('x','1');rect.setAttribute('y','4');
      rect.setAttribute('width','22');rect.setAttribute('height','16');
      rect.setAttribute('rx','5');rect.setAttribute('fill','#e0002a');
      const poly=document.createElementNS(svgNS,'path');
      poly.setAttribute('d','m10 8 6 4-6 4z');poly.setAttribute('fill','#fff');
      svg.append(rect,poly);
      tag.append(svg);
      return tag;
    };
    const enhanceSource=()=>{
      if(busy)return;
      const nameEl=quoteSource.querySelector('.quote-author-name');
      const raw=((nameEl?nameEl.textContent:quoteSource.textContent)||'').replace(/\s*·\s*YouTube\s*$/i,'').trim();
      if(!raw||raw===lastRaw)return;
      busy=true;
      lastRaw=raw;
      const cleanName=raw.replace(/^@+/,'');
      const initial=(cleanName.match(/[\p{L}\p{N}]/u)?.[0]||'Н').toUpperCase();
      quoteSource.setAttribute('aria-label',`${raw} — открыть на YouTube`);
      quoteSource.title='Открыть комментарий на YouTube';
      const av=document.createElement('span');
      av.className='quote-avatar';av.setAttribute('aria-hidden','true');av.textContent=initial;
      const nm=document.createElement('span');
      nm.className='quote-author-name';nm.textContent=raw;
      quoteSource.replaceChildren(av,nm,buildBadge());
      queueMicrotask(()=>{busy=false;});
    };
    enhanceSource();
    new MutationObserver(enhanceSource).observe(quoteSource,{childList:true,characterData:true,subtree:true});
  }
})();
