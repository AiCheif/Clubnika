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
const canOrder=script.hasAttribute('data-show-order');
const COMMENT_URL='https://aicheif.github.io/Clubnika/support.html';
const ORDER_URL='songs.html';
const GRACE_MIN=45,SOON_MIN=5;

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
      `<p id="live-date" hidden></p>`+
    `</div>`+
    `<a class="site-live-order is-comment-cta" id="live-cta" href="${COMMENT_URL}" hidden>✎ Оставить комментарий</a>`+
  `</section>`
);

const el=id=>document.getElementById(id);
const panel=el('live-panel'),clockEl=el('live-clock'),dateEl=el('live-date'),ctaEl=el('live-cta'),labelEl=el('live-label'),titleTextEl=el('live-title').querySelector('span:last-child');

const fmtDayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
const fmtMskFull=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const fmtMskDateOnly=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Moscow'});
const fmtMskTimeOnly=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const fmtLocalTime=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'});

let config={},loaded=false,refreshTimer=null,refreshIntervalMs=60000;
let lastLinksKey='',lastDateKey='',lastCtaMode='';
const prevVals={d:null,h:null,m:null,s:null};
const UNIT_ORDER=['d','h','m','s'];

function validURL(value,allowed){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null;
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
    const eased=1-Math.pow(1-t,4);
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
  },760);
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
    rollIntro(numEl,startVal,value,1250,delay);
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

function updateCta(isStreamDay){
  ctaEl.hidden=false;
  const mode=(canOrder&&isStreamDay)?'order':'comment';
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
  const until=timestamp(config.liveUntil);
  const live=config.status==='live'&&Number.isFinite(until)&&until>now;
  const explicit=timestamp(config.nextStart);
  const cancelled=config.status==='cancelled';

  panel.classList.toggle('is-live',live);
  labelEl.hidden=!live;
  updateLinks(live);

  if(!loaded)return;
  panel.classList.remove('is-loading');

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
  updateCta(isStreamDay);
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

  items.forEach((it,idx)=>syncPart(it.key,it.val,it.forms,idx*150));
  clockEl.setAttribute('aria-label','До начала эфира: '+items.map(it=>`${it.val} ${plural(it.val,it.forms)}`).join(', '));

  const dateKey=`${selectedStart}:${today}`;
  if(dateKey!==lastDateKey){
    lastDateKey=dateKey;
    dateEl.innerHTML=formatStreamDateHTML(selectedStart,today);
  }
}

async function refresh(){
  try{
    const response=await fetch('./live.json',{cache:'no-store'});
    if(response.ok){
      const data=await response.json();
      if(data&&typeof data==='object'&&!Array.isArray(data))config=data;
    }
  }catch{}finally{
    loaded=true;
    render();
  }
}

setTimeout(()=>{if(!loaded){loaded=true;render()}},1200);
refresh();
setInterval(render,1000);
setRefreshRate(60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh()}});
})();