/* Shared platform sections, footer and floating comment action. */
/* удаленые <option value="emerald">Изумрудная</option><option value="sapphire">Сапфировая</option><option value="turquoise">Бирюзовая</option> */
(()=>{
  const config=window.NikaSiteConfig,script=document.currentScript,main=document.querySelector('main');
  if(!config||!main)return;
  const titleOverrides={
    'stream-platforms':'Прямые эфиры',
    'listen':'Музыка',
    'social':'Соцсети'
  };
  const renderRow=section=>{
    const title=titleOverrides[section.id]||section.title;
    const schedule=section.id==='stream-platforms'
      ?'<p class="platform-schedule"><strong>Расписание:</strong> вт и сб в 19:30 (МСК)</p>'
      :'';
    return `<div class="platform-row" id="${section.id}"><div class="platform-row-head"><h2>${title}</h2>${schedule}</div><div class="platform-grid">${section.links.map(link=>`<a class="platform-link" href="${link.href}" ${link.attrs}>${link.html}</a>`).join('')}</div></div>`;
  };
  const markup=`<section class="feature-section site-platforms-hub" aria-label="Площадки и соцсети">${config.platforms.map(renderRow).join('')}</section>`;
  const showPlatforms=!script.hasAttribute('data-hide-platforms');
  if(showPlatforms)main.insertAdjacentHTML('beforeend',markup);

  const MASCOT_STORAGE_KEY='clubnika_mascot_id';
  const POS_STORAGE_KEY_V2='clubnika_mascot_pos_v2';
  const hasFloatingMenu=!script.hasAttribute('data-hide-comment');
  const settingsInner=`<label class="mascot-picker" for="mascot-picker"><span>Маскот</span>
    <select id="mascot-picker" aria-label="Выбор маскота"></select></label>
    <label class="theme-picker" for="theme-picker"><span>Тема</span>
    <select id="theme-picker" aria-label="Тема сайта">
    <option value="scarlet">Алое золото</option><option value="berry">Клубничная</option><option value="winter">Зимняя сказка</option><option value="lavender">Лавандовая</option><option value="honey">Медовая</option><option value="lime">Лаймовая</option><option value="coral">Коралловая</option></select></label>`;

  const settingsMarkup=hasFloatingMenu
    ?`<div class="mascot-screen" data-screen="settings" hidden>
        <button type="button" class="mascot-back-btn" data-go="main">‹ Назад</button>
        <div class="footer-settings mascot-menu-settings">${settingsInner}</div>
      </div>`
    :`<div class="footer-settings">${settingsInner}</div>`;

  
  
  //  script.insertAdjacentHTML('beforebegin',`<footer class="wrap"><span class="footer-brand"><span class="emoji">🍓</span> Ника Моисеева</span><span>С любовью к музыке · <a href="${config.sourceCatalog}" target="_blank" rel="noopener">Полный список песен</a></span>${hasFloatingMenu?'':settingsMarkup}</footer>`);
script.insertAdjacentHTML('beforebegin',`
    <footer class="wrap">
      <div class="footer-info">
        <span class="footer-brand"><span class="emoji">🍓</span> Ника Моисеева</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>С любовью к музыке</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <button type="button" class="footer-share-btn" id="footer-share-btn">Поделиться</button>
      </div>
      ${hasFloatingMenu?'':settingsMarkup}
    </footer>
  `);

  const shareBtn=document.getElementById('footer-share-btn');
  if(shareBtn){
    let resetTimer=0;
    shareBtn.addEventListener('click',async()=>{
      const shareData={title:document.title,url:location.href};
      if(navigator.share&&(!navigator.canShare||navigator.canShare(shareData))){
        try{await navigator.share(shareData);return;}catch(e){if(e.name==='AbortError')return;}
      }
      try{
        await navigator.clipboard.writeText(location.href);
        shareBtn.textContent='Ссылка скопирована ✓';
        clearTimeout(resetTimer);
        resetTimer=setTimeout(()=>{shareBtn.textContent='Поделиться';},2000);
      }catch{}
    });
  }

  if(hasFloatingMenu){
    const FALLBACK_MENU={
      enabled:true,
      showAfterScroll:0,
      autoCloseMs:10000,
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
        <div class="mascot-popover" id="mascot-popover" role="menu" hidden>${settingsMarkup}</div>
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
    const settingsScreen=popover.querySelector('[data-screen="settings"]');
    const mascotSelect=popover.querySelector('#mascot-picker');

    let isOpen=false;
    let videoEl=null;
    let scrollThreshold=FALLBACK_MENU.showAfterScroll;
    let animations={};
    let idleTimer=0,playToken=0,playing=false,greeted=false;
    let contextTimer=0;
    const seenContexts=new Set();
    const contexts=script.hasAttribute('data-home-mascot')?[
      ['#live-panel','check-time'],
      ['.hero .photo-gallery','admire'],
      ['.site-tv-card','applause'],
      ['#translations','watch-shorts'],
      ['#my-music','sing']
    ].map(([selector,name])=>({element:main.querySelector(selector),name})).filter(x=>x.element):[];
    let closeTimer=0,autoCloseMs=FALLBACK_MENU.autoCloseMs;

    // Состояние перетаскивания маскота
    const DRAG_THRESHOLD=6;
    const EDGE_MARGIN=12;
    let isDragging=false;
    let wasDragged=false;
    let hasCustomPos=false;
    let currentLeft=0,currentTop=0;
    let startX=0,startY=0;
    let startLeft=0,startTop=0;

    const applyDockPosition=(left,top,save=false)=>{
      const w=trigger.offsetWidth;
      const h=trigger.offsetHeight;
      if(!w||!h)return;

      const maxLeft=Math.max(EDGE_MARGIN,window.innerWidth-w-EDGE_MARGIN);
      const maxTop=Math.max(EDGE_MARGIN,window.innerHeight-h-EDGE_MARGIN);
      currentLeft=Math.min(Math.max(EDGE_MARGIN,left),maxLeft);
      currentTop=Math.min(Math.max(EDGE_MARGIN,top),maxTop);
      hasCustomPos=true;

      dock.classList.toggle('is-top',currentTop+h/2<window.innerHeight/2);
      dock.classList.toggle('is-left',currentLeft+w/2<window.innerWidth/2);

      // Компенсируем смещение кнопки внутри dock, чтобы при открытии меню двигалось только само меню, а не маскот
      dock.style.left=`${currentLeft-trigger.offsetLeft}px`;
      dock.style.top=`${currentTop-trigger.offsetTop}px`;
      dock.style.right='auto';
      dock.style.bottom='auto';

      if(save){
        try{localStorage.setItem(POS_STORAGE_KEY_V2,JSON.stringify({left:currentLeft,top:currentTop}));}catch{}
      }
    };

    const restoreSavedPosition=()=>{
      try{
        const saved=JSON.parse(localStorage.getItem(POS_STORAGE_KEY_V2)||'null');
        if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)){
          applyDockPosition(saved.left,saved.top,false);
        }
      }catch{}
    };

    const isSelectFocused=()=>dock.contains(document.activeElement)&&document.activeElement?.tagName==='SELECT';
    const canAnimate=()=>videoEl&&!isAnimOff()&&!document.hidden&&!dock.classList.contains('is-hidden')&&!document.querySelector('dialog[open]');
    const scheduleContext=()=>{
      clearTimeout(contextTimer);
      if(!contexts.length||!canAnimate()||isOpen||playing||isDragging)return;
      contextTimer=setTimeout(()=>{
        if(!canAnimate()||isOpen||playing||isDragging)return;
        const height=window.innerHeight;
        const visible=contexts.filter(({name})=>animations[name]&&!seenContexts.has(name)).map(context=>{
          const rect=context.element.getBoundingClientRect();
          const overlap=Math.min(rect.bottom,height)-Math.max(rect.top,0);
          return {...context,overlap,required:Math.min(rect.height,height)*0.45};
        }).filter(x=>x.overlap>0&&x.overlap>=x.required).sort((a,b)=>b.overlap-a.overlap);
        if(visible.length){
          seenContexts.add(visible[0].name);
          playAnimation(visible[0].name);
        }
      },650);
    };
    const stopAnimation=()=>{
      clearTimeout(idleTimer);
      idleTimer=0;
      playToken++;
      playing=false;
      if(videoEl){videoEl.pause();videoEl.hidden=true;}
    };
    const scheduleIdle=()=>{
      clearTimeout(idleTimer);
      idleTimer=0;
      if(!canAnimate()||isOpen)return;
      idleTimer=setTimeout(()=>{
        idleTimer=0;
        const choices=['wink','thumbs-up','salute'].filter(name=>animations[name]);
        if(animations.idle&&(!choices.length||Math.random()<0.5))playAnimation('idle');
        else if(choices.length)playAnimation(choices[Math.floor(Math.random()*choices.length)]);
      },15000+Math.random()*20000);
    };
    const playAnimation=name=>{
      if(!canAnimate()||!animations[name])return;
      stopAnimation();
      const token=playToken;
      playing=true;
      videoEl.src=animations[name];
      const finish=()=>{if(token!==playToken)return;stopAnimation();scheduleIdle();scheduleContext();};
      videoEl.onended=finish;
      videoEl.onerror=finish;
      videoEl.play().then(()=>{if(token===playToken)videoEl.hidden=false;}).catch(finish);
    };

    const update=()=>{
      if(isOpen)return;
      const show=window.scrollY>=scrollThreshold;
      dock.classList.toggle('is-hidden',!show);
      if(!Object.keys(animations).length)return;
      if(!show){stopAnimation();return;}
      if(canAnimate()&&!greeted){greeted=true;playAnimation('greeting');}
      else if(!playing&&!idleTimer)scheduleIdle();
      scheduleContext();
    };

    const resetCloseTimer=()=>{
      clearTimeout(closeTimer);
      if(isOpen&&autoCloseMs>0){
        closeTimer=setTimeout(()=>{
          if(isSelectFocused()){resetCloseTimer();return;}
          setOpen(false);
        },autoCloseMs);
      }
    };

    const showScreen=name=>{
      popover.querySelectorAll('.mascot-screen').forEach(s=>{
        s.hidden=s.dataset.screen!==name;
      });
      if(hasCustomPos)applyDockPosition(currentLeft,currentTop,false);
      resetCloseTimer();
    };

    const setOpen=next=>{
      isOpen=Boolean(next);
      resetCloseTimer();
      trigger.setAttribute('aria-expanded',String(isOpen));
      popover.hidden=!isOpen;
      dock.classList.toggle('is-open',isOpen);
      if(hasCustomPos)applyDockPosition(currentLeft,currentTop,false);
      if(isOpen)playAnimation('invite');
      else {
        showScreen('main');
        playAnimation('salute');
        update();
      }
    };

    const syncPlayback=()=>{
      if(!videoEl)return;
      if(Object.keys(animations).length){
        if(!canAnimate())stopAnimation();
        else if(!playing){if(!greeted){greeted=true;playAnimation('greeting');}else scheduleIdle();}
        return;
      }
      if(isAnimOff()||document.hidden){
        videoEl.pause();
      }else{
        videoEl.play().catch(()=>{});
      }
    };

    const applyMascot=m=>{
      stopAnimation();
      greeted=false;
      videoEl=null;
      dock.classList.remove('has-animated-mascot');
      mediaBox.innerHTML='';

      const imgSrc=safeHref(m?.image);
      const vidSrc=safeHref(m?.video);
      animations=Object.fromEntries(Object.entries(m?.animations||{}).map(([name,src])=>[name,safeHref(src)]).filter(([,src])=>src));

      if(imgSrc&&Object.keys(animations).length){
        dock.classList.add('has-animated-mascot');
        mediaBox.innerHTML=`<img src="${esc(imgSrc)}" alt="" width="384" height="384">${isSafari?'':'<video muted playsinline preload="none" hidden aria-hidden="true"></video>'}`;
        videoEl=mediaBox.querySelector('video');
      }else if(vidSrc&&!isSafari){
        mediaBox.innerHTML=`<video autoplay loop muted playsinline ${imgSrc?`poster="${esc(imgSrc)}"`:''} aria-hidden="true"><source src="${esc(vidSrc)}" type="video/webm"></video>`;
        videoEl=mediaBox.querySelector('video');
        syncPlayback();
      }else if(imgSrc){
        mediaBox.innerHTML=`<img src="${esc(imgSrc)}" alt="${esc(m?.alt||'')}" width="64" height="64">`;
      }

      const imgEl=mediaBox.querySelector('img');
      if(imgEl){
        imgEl.onerror=()=>{
          dock.classList.remove('has-animated-mascot');
          mediaBox.innerHTML='';
        };
      }
    };

    const renderMenu=cfg=>{
      const items=(Array.isArray(cfg?.items)?cfg.items:[]).filter(it=>it&&it.enabled!==false&&it.title);
      if(!cfg||cfg.enabled===false||!items.length){
        if(settingsScreen){
          const body=settingsScreen.querySelector('.footer-settings');
          body?.classList.remove('mascot-menu-settings');
          if(body)document.querySelector('footer.wrap')?.append(body);
        }
        dock.remove();
        return;
      }

      const rawScroll=Number(cfg.showAfterScroll);
      scrollThreshold=Number.isFinite(rawScroll)?Math.max(0,rawScroll):FALLBACK_MENU.showAfterScroll;
      const rawAutoClose=Number(cfg.autoCloseMs);
      autoCloseMs=Number.isFinite(rawAutoClose)?Math.max(0,rawAutoClose):FALLBACK_MENU.autoCloseMs;

      if(cfg.label){
        labelBox.textContent=cfg.label;
        trigger.setAttribute('aria-label',cfg.label);
      }

      const list=Array.isArray(cfg.mascots)&&cfg.mascots.length
        ?cfg.mascots
        :[{id:'default',name:cfg.mascot?.alt||'Клубничка',...(cfg.mascot||{})}];

      let savedId='';
      try{savedId=localStorage.getItem(MASCOT_STORAGE_KEY)||'';}catch{}
      const currentMascot=list.find(x=>x.id===savedId)||list[0];

      if(mascotSelect){
        mascotSelect.innerHTML=list.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('');
        mascotSelect.value=currentMascot.id;
        mascotSelect.disabled=list.length<2;
        mascotSelect.onchange=()=>{
          const next=list.find(x=>x.id===mascotSelect.value)||list[0];
          try{localStorage.setItem(MASCOT_STORAGE_KEY,next.id);}catch{}
          applyMascot(next);
          if(isOpen)playAnimation('invite');
          else update();
        };
      }

      applyMascot(currentMascot);

      const linksMarkup=items.map(item=>{
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

      popover.innerHTML=`
        <div class="mascot-screen" data-screen="main">
          ${linksMarkup}
          <button type="button" class="mascot-item mascot-nav-btn" data-go="settings">
            <span class="mascot-item-icon" aria-hidden="true">⚙️</span>
            <span class="mascot-item-body"><span class="mascot-item-title">Настройки</span></span>
            <span class="mascot-item-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      `;
      if(settingsScreen)popover.append(settingsScreen);
      update();
      restoreSavedPosition();
    };

    if(typeof ResizeObserver!=='undefined'){
      new ResizeObserver(()=>{
        if(hasCustomPos&&!isDragging)applyDockPosition(currentLeft,currentTop,false);
      }).observe(trigger);
    }

    trigger.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.pointerType==='mouse')return;
      const rect=trigger.getBoundingClientRect();
      isDragging=true;
      wasDragged=false;
      startX=e.clientX;
      startY=e.clientY;
      startLeft=rect.left;
      startTop=rect.top;
      trigger.setPointerCapture(e.pointerId);
    });

    trigger.addEventListener('pointermove',e=>{
      if(!isDragging)return;
      const dx=e.clientX-startX;
      const dy=e.clientY-startY;

      if(!wasDragged&&Math.hypot(dx,dy)>DRAG_THRESHOLD){
        wasDragged=true;
        dock.classList.add('is-dragging');
        if(isOpen)setOpen(false);
      }

      if(wasDragged){
        applyDockPosition(startLeft+dx,startTop+dy,false);
      }
    });

    const endDrag=e=>{
      if(!isDragging)return;
      isDragging=false;
      dock.classList.remove('is-dragging');
      if(trigger.hasPointerCapture?.(e.pointerId)){
        trigger.releasePointerCapture(e.pointerId);
      }
      if(wasDragged){
        applyDockPosition(currentLeft,currentTop,true);
      }
    };

    trigger.addEventListener('pointerup',endDrag);
    trigger.addEventListener('pointercancel',endDrag);

    trigger.addEventListener('click',e=>{
      if(wasDragged){
        e.preventDefault();
        e.stopImmediatePropagation();
        wasDragged=false;
        return;
      }
      setOpen(!isOpen);
    });

    trigger.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!isOpen&&!playing&&greeted&&!isDragging)playAnimation('wink');});

    const closeOutside=e=>{
      if(!isOpen)return;
      const target=e.target instanceof Node?e.target:e.target?.parentNode;
      if(target&&!dock.contains(target))setOpen(false);
    };
    document.addEventListener('pointerdown',closeOutside,true);
    document.addEventListener('touchstart',closeOutside,{capture:true,passive:true});

    dock.addEventListener('pointerdown',resetCloseTimer);
    popover.addEventListener('focusin',resetCloseTimer);
    popover.addEventListener('pointermove',resetCloseTimer);
    popover.addEventListener('change',resetCloseTimer);
    document.getElementById('theme-picker')?.addEventListener('change',()=>playAnimation('theme-change'));

    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&isOpen){
        setOpen(false);
        trigger.focus();
      }
    });

    popover.addEventListener('click',e=>{
      const navBtn=e.target.closest('[data-go]');
      if(navBtn){
        e.stopPropagation();
        showScreen(navBtn.dataset.go);
        return;
      }
      if(e.target.closest('a'))setOpen(false);
    });

    document.addEventListener('visibilitychange',syncPlayback);
    document.addEventListener('visibilitychange',scheduleContext);
    document.addEventListener('clubnika:animchange',syncPlayback);
    document.addEventListener('clubnika:animchange',scheduleContext);
    reducedQuery.addEventListener?.('change',syncPlayback);

    addEventListener('scroll',()=>{
      if(isOpen){
        if(isSelectFocused())return;
        setOpen(false);
      }else{
        update();
        if(!hasCustomPos)restoreSavedPosition();
      }
    },{passive:true});
    addEventListener('resize',()=>{
      update();
      if(hasCustomPos)applyDockPosition(currentLeft,currentTop,false);
    });
    addEventListener('pageshow',()=>{
      update();
      restoreSavedPosition();
    });
    requestAnimationFrame(()=>{
      update();
      restoreSavedPosition();
    });

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
