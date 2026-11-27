/* Shared next-stream panel. Add data-show-order to switch CTA to song-order on stream day. */
(()=>{
const script=document.currentScript;
if(script&&script.src){
  const cssHref=new URL('../css/site-live-panel.css',script.src).href;
  if(!document.querySelector(`link[rel="stylesheet"][href="${cssHref}"]`)){
    const linkEl=document.createElement('link');
    linkEl.rel='stylesheet';
    linkEl.href=cssHref;
    document.head.appendChild(linkEl);
  }
}

const site=window.NikaSiteConfig;
const defaults=site.liveDefaults;
const platforms=site.platforms.find(section=>section.id==='stream-platforms').links;
const hosts={youtube:['youtube.com','youtu.be'],twitch:['twitch.tv'],vkLive:['vkvideo.ru','vk.ru','vk.com']};
const replayHosts={youtube:['youtube.com','youtu.be'],vk:['vk.ru','vk.com','vkvideo.ru']};
const canOrder=script.hasAttribute('data-show-order');
const COMMENT_URL='support.html';
const ORDER_URL='songs.html';
const GRACE_MIN=45,SOON_MIN=5;

const FALLBACK_PROMPTS=[
  'Какая песня сегодня попала прямо в настроение — и почему?',
  'Какой момент эфира вызвал улыбку или мурашки?',
  'С каким чувством вы закрыли трансляцию?',
  'Какую песню хочется услышать на следующем вечере?'
];

const links=platforms.map(link=>{
  const key=link.attrs.match(/data-live-platform="([^"]+)"/)[1];
  const label=link.text||key;
  return `<a class="site-live-link" id="watch-${key}" href="${link.href}" aria-label="Смотреть на ${label}" title="${label}" ${link.attrs}>${link.html.replace('platform-mark','site-live-icon')}</a>`;
}).join('');

script.insertAdjacentHTML(
  'beforebegin',
  `<section class="site-live-panel is-loading" id="live-panel" aria-label="Ближайший эфир">`+
    `<div class="eyebrow site-live-label" id="live-label" hidden>● ПРЯМОЙ ЭФИР</div>`+
    `<div class="site-live-heading">`+
      `<h2 id="live-title"><span class="live-beacon" aria-hidden="true"></span><span></span></h2>`+
      `<div class="site-live-links" aria-label="Площадки трансляций">${links}</div>`+
    `</div>`+
    `<div class="site-live-body">`+
      `<div class="site-live-clock" id="live-clock" role="timer" aria-live="off" hidden></div>`+
      `<div class="live-prompt-carousel" id="live-prompt-carousel" hidden>`+
        `<div class="live-prompt-head">`+
          `<span class="live-prompt-tag">💡 О чём можно написать в комментарии:</span>`+
          `<button type="button" class="live-prompt-next" id="live-prompt-next" title="Следующая тема" aria-label="Показать другую тему">↻</button>`+
        `</div>`+
        `<p class="live-prompt-text" id="live-prompt-text"></p>`+
      `</div>`+
      `<div class="live-replay-actions" id="live-replay-actions" hidden>`+
        `<a class="live-replay-btn is-yt" id="live-replay-yt" href="https://www.youtube.com/@nikamoiseeva/streams" target="_blank" rel="noopener noreferrer">`+
          `<div class="live-replay-cover" id="live-replay-yt-cover" hidden>`+
            `<img id="live-replay-yt-img" alt="">`+
            `<span class="live-replay-play" aria-hidden="true">▶</span>`+
          `</div>`+
          `<div class="live-replay-main">`+
            `<span class="live-replay-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="5" fill="#fff"/><path d="m10 8 6 4-6 4z" fill="#e0002a"/></svg></span>`+
            `<span class="live-replay-copy">`+
              `<span class="live-replay-stream-title" id="live-replay-yt-title" hidden></span>`+
              `<strong>Написать на YouTube</strong>`+
              `<small>Откройте запись и оставьте отзыв под видео →</small>`+
            `</span>`+
          `</div>`+
        `</a>`+
        `<a class="live-replay-btn is-vk" id="live-replay-vk" href="https://vk.ru/nikamoiseevaa" target="_blank" rel="noopener noreferrer">`+
          `<div class="live-replay-cover" id="live-replay-vk-cover" hidden>`+
            `<img id="live-replay-vk-img" alt="">`+
            `<span class="live-replay-play" aria-hidden="true">▶</span>`+
          `</div>`+
          `<div class="live-replay-main">`+
            `<span class="live-replay-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 5.5a2 2 0 0 1 3-.2l9 5.2a1.8 1.8 0 0 1 0 3l-9 5.2a2 2 0 0 1-3-1.7z" fill="#fff"/><path d="m8 5 5 3-5 9z" fill="#0077ff"/></svg></span>`+
            `<span class="live-replay-copy">`+
              `<span class="live-replay-stream-title" id="live-replay-vk-title" hidden></span>`+
              `<strong>Написать в ВК</strong>`+
              `<small>Оставьте комментарий под записью эфира в ВК →</small>`+
            `</span>`+
          `</div>`+
        `</a>`+
      `</div>`+
      `<p id="live-date" hidden></p>`+
    `</div>`+
    `<a class="site-live-order is-comment-cta" id="live-cta" href="${COMMENT_URL}" hidden>✎ Оставить комментарий</a>`+
  `</section>`
);

const el=id=>document.getElementById(id);
const panel=el('live-panel'),clockEl=el('live-clock'),dateEl=el('live-date'),ctaEl=el('live-cta'),labelEl=el('live-label'),titleTextEl=el('live-title').querySelector('span:last-child');
const carouselEl=el('live-prompt-carousel'),promptTextEl=el('live-prompt-text'),promptNextBtn=el('live-prompt-next');
const replayBoxEl=el('live-replay-actions');

const fmtDayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
const fmtMskFull=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const fmtMskDateOnly=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Moscow'});
const fmtMskTimeOnly=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const fmtLocalTime=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'});

let config={},streamsData={},promptsList=[...FALLBACK_PROMPTS],loaded=false,refreshTimer=null,refreshIntervalMs=60000;
let lastLinksKey='',lastDateKey='',lastCtaMode='',lastReplayKey='';
let promptIndex=0,carouselTimer=null;
const prevVals={d:null,h:null,m:null,s:null};
const UNIT_ORDER=['d','h','m','s'];

function validURL(value,allowed){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const u=new URL(value.trim());
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed.some(h=>u.hostname===h||u.hostname===`www.${h}`||u.hostname===`m.${h}`||u.hostname.endsWith('.'+h))?u.href:null;
  }catch{return null}
}

function validCoverURL(value){
  if(typeof value!=='string'||!value.trim())return null;
  const trimmed=value.trim();
  if(/^[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp|avif)(?:\?.*)?$/i.test(trimmed))return trimmed;
  try{
    const u=new URL(trimmed);
    return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;
  }catch{return null}
}

function extractYouTubeId(urlStr){
  try{
    const u=new URL(urlStr);
    if(u.hostname==='youtu.be'||u.hostname==='www.youtu.be'){
      return u.pathname.slice(1).split('/')[0]||null;
    }
    if(u.searchParams.get('v'))return u.searchParams.get('v');
    const m=u.pathname.match(/^\/(?:live|shorts|embed)\/([^/?#]+)/);
    return m?m[1]:null;
  }catch{return null}
}

async function fetchYouTubeTitle(videoId){
  try{
    const oembedUrl='https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+videoId)+'&format=json';
    const res=await fetch(oembedUrl);
    if(!res.ok)return null;
    const json=await res.json();
    return typeof json.title==='string'&&json.title.trim()?json.title.trim():null;
  }catch{return null}
}

function timestamp(value){
  return typeof value==='string'&&/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN;
}

function regularNext(now){
  const moscow=new Date(now+3*3600000);
  for(let i=0;i<=7;i++){
    const day=new Date(Date.UTC(moscow.getUTCFullYear(),moscow.getUTCMonth(),moscow.getUTCDate()+i,16,30));
    if([2,6].includes(day.getUTCDay())&&day.getTime()>now)return day.getTime();
  }
  return null;
}

function regularPrev(now){
  const moscow=new Date(now+3*3600000);
  for(let i=0;i>=-7;i--){
    const t=Date.UTC(moscow.getUTCFullYear(),moscow.getUTCMonth(),moscow.getUTCDate()+i,16,30);
    if([2,6].includes(new Date(t).getUTCDay())&&t<=now)return t;
  }
  return null;
}

function plural(n,forms){
  const a=n%100,b=n%10;
  return forms[a>=11&&a<=14?2:b===1?0:b>=2&&b<=4?1:2];
}

function animEnabled(){
  const mode=document.documentElement.dataset.anim;
  if(mode==='off')return false;
  if(mode==='full'||mode==='soft')return true;
  return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function rollIntro(numEl,from,to,duration,delay){
  if(!animEnabled()||from===to){
    numEl.textContent=String(to);
    return;
  }
  const start=performance.now()+delay;
  function frame(now){
    if(now<start){
      requestAnimationFrame(frame);
      return;
    }
    const t=Math.min((now-start)/duration,1);
    const eased=1-Math.pow(1-t,5);
    numEl.textContent=String(Math.round(from+(to-from)*eased));
    if(t<1)requestAnimationFrame(frame);
    else numEl.textContent=String(to);
  }
  numEl.textContent=String(from);
  requestAnimationFrame(frame);
}

function rollStep(numEl,from,to){
  if(!animEnabled()||from===to){
    numEl.textContent=String(to);
    return;
  }
  numEl.innerHTML=`<span class="clock-roll-track"><span class="clock-roll-old" aria-hidden="true">${from}</span><span class="clock-roll-new">${to}</span></span>`;
  clearTimeout(numEl._rollTimer);
  numEl._rollTimer=setTimeout(()=>{
    if(numEl)numEl.textContent=String(to);
  },860);
}

function insertPartInOrder(partEl,key){
  const targetIdx=UNIT_ORDER.indexOf(key);
  const existing=Array.from(clockEl.children);
  const nextSibling=existing.find(node=>UNIT_ORDER.indexOf(node.dataset.unit)>targetIdx);
  if(nextSibling)clockEl.insertBefore(partEl,nextSibling);
  else clockEl.appendChild(partEl);
}

function syncPart(key,value,forms,delay){
  let partEl=clockEl.querySelector(`[data-unit="${key}"]`);
  if(!partEl){
    partEl=document.createElement('span');
    partEl.className='clock-part';
    partEl.dataset.unit=key;
    partEl.innerHTML=`<strong class="clock-num">${value}</strong><span class="clock-unit">${plural(value,forms)}</span>`;
    insertPartInOrder(partEl,key);
    prevVals[key]=null;
  }
  const numEl=partEl.querySelector('.clock-num');
  const unitEl=partEl.querySelector('.clock-unit');
  unitEl.textContent=plural(value,forms);

  if(prevVals[key]===null){
    const startVal=value>0?Math.max(0,value-Math.min(value,15)):0;
    rollIntro(numEl,startVal,value,2300,delay);
    prevVals[key]=value;
  }else if(prevVals[key]!==value){
    rollStep(numEl,prevVals[key],value);
    prevVals[key]=value;
  }
}

function clearClock(){
  if(clockEl.children.length)clockEl.innerHTML='';
  clockEl.hidden=true;
  clockEl.removeAttribute('aria-label');
  prevVals.d=prevVals.h=prevVals.m=prevVals.s=null;
}

function getCarouselPool(){
  const customQ=(typeof streamsData.question==='string'&&streamsData.question.trim())
    ?streamsData.question.trim()
    :(typeof config.question==='string'&&config.question.trim()?config.question.trim():'');
  if(!customQ)return promptsList;
  return [customQ,...promptsList.filter(q=>q!==customQ)];
}

function showPrompt(step=0,animate=true){
  const pool=getCarouselPool();
  if(!pool.length)return;
  promptIndex=(promptIndex+step+pool.length)%pool.length;
  const text=pool[promptIndex];
  if(!animate||!animEnabled()){
    promptTextEl.textContent=`«${text}»`;
    return;
  }
  promptTextEl.classList.add('is-switching');
  clearTimeout(promptTextEl._swapTimer);
  promptTextEl._swapTimer=setTimeout(()=>{
    promptTextEl.textContent=`«${text}»`;
    promptTextEl.classList.remove('is-switching');
  },220);
}

function startCarousel(){
  if(carouselEl.hidden===false&&carouselTimer)return;
  carouselEl.hidden=false;
  showPrompt(0,false);
  clearInterval(carouselTimer);
  carouselTimer=setInterval(()=>showPrompt(1,true),6500);
}

function stopCarousel(){
  carouselEl.hidden=true;
  clearInterval(carouselTimer);
  carouselTimer=null;
}

promptNextBtn?.addEventListener('click',()=>{
  showPrompt(1,true);
  if(carouselTimer){
    clearInterval(carouselTimer);
    carouselTimer=setInterval(()=>showPrompt(1,true),6500);
  }
});

function setReplayCardCover(key,coverUrl,altText){
  const coverBox=el(`live-replay-${key}-cover`);
  const img=el(`live-replay-${key}-img`);
  if(!coverBox||!img)return;
  if(!coverUrl){
    coverBox.hidden=true;
    img.classList.remove('is-loaded');
    img.removeAttribute('src');
    return;
  }
  coverBox.hidden=false;
  img.classList.remove('is-loaded');
  img.onload=()=>{img.classList.add('is-loaded')};
  img.onerror=()=>{
    img.classList.remove('is-loaded');
    img.removeAttribute('src');
    coverBox.hidden=true;
  };
  img.alt=altText||'';
  img.src=coverUrl;
}

function setReplayCardTitle(key,titleText){
  const titleEl=el(`live-replay-${key}-title`);
  if(!titleEl)return;
  if(titleText){
    titleEl.textContent=titleText;
    titleEl.hidden=false;
  }else{
    titleEl.textContent='';
    titleEl.hidden=true;
  }
}

function updateReplayButtons(){
  const sig=JSON.stringify({
    yt:streamsData.youtube||'',
    vk:streamsData.vk||'',
    title:streamsData.title||'',
    ytTitle:streamsData.youtubeTitle||'',
    vkTitle:streamsData.vkTitle||'',
    cover:streamsData.cover||'',
    ytCover:streamsData.youtubeCover||'',
    vkCover:streamsData.vkCover||''
  });
  if(sig===lastReplayKey)return;
  lastReplayKey=sig;

  const fallbacks={
    yt:'https://www.youtube.com/@nikamoiseeva/streams',
    vk:'https://vk.ru/nikamoiseevaa'
  };
  const commonTitle=typeof streamsData.title==='string'?streamsData.title.trim():'';

  for(const [shortKey,hostKey] of [['yt','youtube'],['vk','vk']]){
    const btn=el(`live-replay-${shortKey}`);
    const url=validURL(streamsData[hostKey],replayHosts[hostKey]);
    if(!url){
      btn.href=fallbacks[shortKey];
      btn.classList.remove('has-preview');
      setReplayCardTitle(shortKey,'');
      setReplayCardCover(shortKey,null,'');
      continue;
    }

    btn.href=url;
    btn.classList.add('has-preview');

    const customTitle=typeof streamsData[hostKey+'Title']==='string'?streamsData[hostKey+'Title'].trim():'';
    const initialTitle=customTitle||commonTitle;
    setReplayCardTitle(shortKey,initialTitle);

    let coverUrl=validCoverURL(streamsData[hostKey+'Cover']||streamsData.cover);
    if(hostKey==='youtube'){
      const videoId=extractYouTubeId(url);
      if(videoId){
        if(!coverUrl)coverUrl=`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
        if(!customTitle){
          fetchYouTubeTitle(videoId).then(ytTitle=>{
            if(ytTitle&&btn.classList.contains('has-preview'))setReplayCardTitle('yt',ytTitle);
          });
        }
      }
    }
    setReplayCardCover(shortKey,coverUrl,initialTitle);
  }
}

function updateLinks(live){
  const sig=live+':'+Object.keys(defaults).map(k=>config.links?.[k]||'').join('|');
  if(sig===lastLinksKey)return;
  lastLinksKey=sig;
  for(const key of Object.keys(defaults)){
    const link=el('watch-'+key);
    if(!link)continue;
    link.href=(live?validURL(config.links?.[key],hosts[key]):null)||defaults[key];
    link.hidden=false;
    document.querySelectorAll('[data-live-platform="'+key+'"]').forEach(other=>other.href=link.href);
  }
}

function updateCta(mode){
  if(mode==='hidden'){
    ctaEl.hidden=true;
    lastCtaMode='hidden';
    return;
  }
  ctaEl.hidden=false;
  if(mode===lastCtaMode)return;
  lastCtaMode=mode;
  if(mode==='order'){
    ctaEl.href=ORDER_URL;
    ctaEl.textContent='♫ Заказать песню';
    ctaEl.classList.remove('is-comment-cta');
  }else{
    ctaEl.href=COMMENT_URL;
    ctaEl.textContent='✎ Оставить комментарий';
    ctaEl.classList.add('is-comment-cta');
  }
}

function formatStreamDateHTML(ts,isToday){
  const iso=new Date(ts).toISOString();
  const mskTime=fmtMskTimeOnly.format(ts);
  const localTime=fmtLocalTime.format(ts);
  const localSuffix=localTime!==mskTime?` <span class="live-date-local">· у вас ${localTime}</span>`:'';
  if(isToday){
    return `<time datetime="${iso}">${fmtMskDateOnly.format(ts)}, около ${mskTime} МСК</time>${localSuffix}`;
  }
  return `<time datetime="${iso}">${fmtMskFull.format(ts)} (МСК)</time>${localSuffix}`;
}

function setRefreshRate(ms){
  if(refreshIntervalMs===ms&&refreshTimer)return;
  refreshIntervalMs=ms;
  clearInterval(refreshTimer);
  refreshTimer=setInterval(refresh,ms);
}

function render(){
  const now=Date.now();
  const status=config.status||'scheduled';
  const until=timestamp(config.liveUntil);
  const live=status==='live'&&Number.isFinite(until)&&until>now;
  const endedPending=status==='ended_pending';
  const replayReady=status==='replay_ready';
  const cancelled=status==='cancelled';
  const explicit=timestamp(config.nextStart);

  panel.classList.toggle('is-live',live);
  panel.classList.toggle('is-post-stream',endedPending||replayReady);
  labelEl.hidden=!live;
  updateLinks(live);

  if(!loaded)return;
  panel.classList.remove('is-loading');

  // Режим 1: Эфир закончен, ждём ссылки на записи -> карусель тем для комментариев
  if(endedPending){
    clearClock();
    replayBoxEl.hidden=true;
    panel.classList.remove('is-today','is-late');
    titleTextEl.textContent='Эфир завершился — скоро появятся ссылки на записи';
    startCarousel();
    const pendingMsg='А пока можно подумать, какими впечатлениями поделиться под видео.';
    if(lastDateKey!=='ended_pending'){
      lastDateKey='ended_pending';
      dateEl.textContent=pendingMsg;
    }
    dateEl.hidden=false;
    updateCta('comment');
    setRefreshRate(20000);
    return;
  }

  // Режим 2: Ссылки на записи готовы -> две большие кнопки из streams.json
  if(replayReady){
    clearClock();
    stopCarousel();
    panel.classList.remove('is-today','is-late');
    titleTextEl.textContent='Запись эфира уже готова — поделитесь впечатлениями!';
    updateReplayButtons();
    replayBoxEl.hidden=false;
    const replayMsg='Выберите площадку и напишите пару строк в комментариях под записью (не в чате).';
    if(lastDateKey!=='replay_ready'){
      lastDateKey='replay_ready';
      dateEl.textContent=replayMsg;
    }
    dateEl.hidden=false;
    updateCta('hidden');
    setRefreshRate(60000);
    return;
  }

  stopCarousel();
  replayBoxEl.hidden=true;

  const prev=regularPrev(now);
  const lastStart=Number.isFinite(explicit)
    ?(explicit>now?null:Math.max(explicit,prev??0))
    :prev;
  const late=!live&&!cancelled&&lastStart!==null&&(now-lastStart)<GRACE_MIN*60000;
  const lateMin=late?Math.floor((now-lastStart)/60000):0;

  const selectedStart=!live&&!cancelled&&!late
    ?(Number.isFinite(explicit)&&explicit>now?explicit:regularNext(now))
    :null;

  const today=selectedStart!==null&&fmtDayKey.format(selectedStart)===fmtDayKey.format(now);
  const isStreamDay=live||late||today;

  panel.classList.toggle('is-today',today||late);
  panel.classList.toggle('is-late',late);
  updateCta((canOrder&&isStreamDay)?'order':'comment');
  setRefreshRate(late?20000:60000);

  if(live){
    clearClock();
    titleTextEl.textContent='Сейчас в эфире!';
    const liveMsg=config.title||'Присоединяйтесь к музыкальному вечеру!';
    if(lastDateKey!=='live:'+liveMsg){
      lastDateKey='live:'+liveMsg;
      dateEl.textContent=liveMsg;
    }
    dateEl.hidden=false;
    return;
  }

  if(late){
    clearClock();
    const isSoon=lateMin<SOON_MIN;
    titleTextEl.textContent=isSoon?'Эфир вот-вот начнётся!':'Чуть задерживаемся';
    const lateMsg=isSoon
      ?'Заходите на любую площадку — старт с минуты на минуту.'
      :'Небольшая техническая пауза, скоро начнём. Новости в Telegram.';
    if(lastDateKey!=='late:'+isSoon){
      lastDateKey='late:'+isSoon;
      dateEl.textContent=lateMsg;
    }
    dateEl.hidden=false;
    return;
  }

  if(!selectedStart){
    clearClock();
    titleTextEl.textContent='До нашего эфира';
    const emptyMsg='Следите за анонсами ближайшего эфира в Telegram.';
    if(lastDateKey!=='empty'){
      lastDateKey='empty';
      dateEl.textContent=emptyMsg;
    }
    dateEl.hidden=false;
    return;
  }

  titleTextEl.textContent=today?'Сегодня поём!':'До нашего эфира';
  clockEl.hidden=false;
  dateEl.hidden=false;

  const diffMs=Math.max(0,selectedStart-now);
  const totalSec=Math.ceil(diffMs/1000);
  const underHour=totalSec<3600;

  let items;
  if(underHour){
    const m=Math.floor(totalSec/60);
    const s=totalSec%60;
    items=[
      m?{key:'m',val:m,forms:['минута','минуты','минут']}:null,
      {key:'s',val:s,forms:['секунда','секунды','секунд']}
    ].filter(Boolean);
  }else{
    const totalMin=Math.ceil(diffMs/60000);
    const d=Math.floor(totalMin/1440);
    const h=Math.floor((totalMin%1440)/60);
    const m=totalMin%60;
    items=[
      d?{key:'d',val:d,forms:['день','дня','дней']}:null,
      (d||h)?{key:'h',val:h,forms:['час','часа','часов']}:null,
      {key:'m',val:m,forms:['минута','минуты','минут']}
    ].filter(Boolean);
  }

  const activeKeys=new Set(items.map(it=>it.key));
  clockEl.querySelectorAll('.clock-part').forEach(node=>{
    if(!activeKeys.has(node.dataset.unit)){
      prevVals[node.dataset.unit]=null;
      node.remove();
    }
  });

  items.forEach((it,idx)=>syncPart(it.key,it.val,it.forms,idx*240));
  clockEl.setAttribute('aria-label','До начала эфира: '+items.map(it=>`${it.val} ${plural(it.val,it.forms)}`).join(', '));

  const dateKey=`${selectedStart}:${today}`;
  if(dateKey!==lastDateKey){
    lastDateKey=dateKey;
    dateEl.innerHTML=formatStreamDateHTML(selectedStart,today);
  }
}

async function loadPrompts(){
  try{
    const res=await fetch('./comment-prompts.json',{cache:'no-store'});
    if(!res.ok)return;
    const list=await res.json();
    if(Array.isArray(list)){
      const cleaned=list.filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim());
      if(cleaned.length)promptsList=cleaned;
    }
  }catch{}
}

async function refresh(){
  try{
    const [liveRes,streamsRes]=await Promise.all([
      fetch('./live.json',{cache:'no-store'}).catch(()=>null),
      fetch('./streams.json',{cache:'no-store'}).catch(()=>null)
    ]);
    if(liveRes&&liveRes.ok){
      const data=await liveRes.json();
      if(data&&typeof data==='object'&&!Array.isArray(data))config=data;
    }
    if(streamsRes&&streamsRes.ok){
      const sData=await streamsRes.json();
      if(sData&&typeof sData==='object'&&!Array.isArray(sData))streamsData=sData;
    }
  }catch{}finally{
    loaded=true;
    render();
  }
}

loadPrompts();
setTimeout(()=>{if(!loaded){loaded=true;render()}},1200);
refresh();
setInterval(render,1000);
setRefreshRate(60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh()}});
})();