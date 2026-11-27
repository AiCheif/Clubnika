/* Shared next-stream panel. Add data-show-order to show the song-order button. */
(()=>{
const script=document.currentScript;
const site=window.NikaSiteConfig;
const defaults=site.liveDefaults;
const platforms=site.platforms.find(section=>section.id==='stream-platforms').links;
const hosts={youtube:['youtube.com','youtu.be'],twitch:['twitch.tv'],vkLive:['vkvideo.ru','vk.ru','vk.com']};
const links=platforms.map(link=>{
 const key=link.attrs.match(/data-live-platform="([^"]+)"/)[1];
 return `<a class="site-live-link" id="watch-${key}" href="${link.href}" ${link.attrs}>${link.html.replace('platform-mark','site-live-icon')}</a>`;
}).join('');
const order=script.hasAttribute('data-show-order')?'<a class="site-live-order" href="songs.html">♫ Заказать песню</a>':'';
script.insertAdjacentHTML('beforebegin',`<section class="site-live-panel is-loading" id="live-panel" hidden aria-label="Ближайший эфир"><div class="eyebrow site-live-label" id="live-label" hidden>● ПРЯМОЙ ЭФИР</div><div class="site-live-heading"><h2 id="live-title"><span class="live-beacon" aria-hidden="true"></span><span></span></h2><div class="site-live-links" aria-label="Площадки трансляций">${links}</div></div><div class="site-live-clock" id="live-clock" hidden></div><p id="live-date" hidden></p>${order}</section>`);
const el=id=>document.getElementById(id);
let config={},selectedStart=null,loaded=false;
const prevVals={d:null,h:null,m:null};

function validURL(value,allowed){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch{return null}}
function timestamp(value){return typeof value==='string'&&/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN}
function regularNext(now){const moscow=new Date(now+3*3600000);for(let i=0;i<=7;i++){const day=new Date(Date.UTC(moscow.getUTCFullYear(),moscow.getUTCMonth(),moscow.getUTCDate()+i,16,30));if([2,6].includes(day.getUTCDay())&&day.getTime()>now)return day.getTime()}return null}
function plural(n,forms){const a=n%100,b=n%10;return forms[a>=11&&a<=14?2:b===1?0:b>=2&&b<=4?1:2]}

function animEnabled(){
  if(document.documentElement.dataset.anim==='off')return false;
  return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function rollNumber(numEl,from,to,duration,delay){
  if(!animEnabled()||from===to){
    numEl.textContent=String(to);
    return;
  }
  const steps=Math.abs(to-from);
  const start=performance.now()+delay;
  function frame(now){
    if(now<start){
      requestAnimationFrame(frame);
      return;
    }
    const t=Math.min((now-start)/duration,1);
    const eased=1-Math.pow(1-t,4);
    const current=Math.round(from+(to-from)*eased);
    numEl.textContent=String(current);
    if(t<1){
      requestAnimationFrame(frame);
    }else{
      numEl.textContent=String(to);
    }
  }
  if(steps===1){
    numEl.innerHTML=`<span class="clock-roll-track"><span class="clock-roll-old">${from}</span><span class="clock-roll-new">${to}</span></span>`;
    setTimeout(()=>{if(numEl)numEl.textContent=String(to)},780);
  }else{
    numEl.textContent=String(from);
    requestAnimationFrame(frame);
  }
}

function syncPart(clockEl,key,value,forms,delay){
  let partEl=clockEl.querySelector(`[data-unit="${key}"]`);
  if(!partEl){
    partEl=document.createElement('span');
    partEl.className='clock-part';
    partEl.dataset.unit=key;
    partEl.innerHTML=`<strong class="clock-num">${value}</strong><span class="clock-unit">${plural(value,forms)}</span>`;
    clockEl.appendChild(partEl);
    prevVals[key]=null;
  }
  const numEl=partEl.querySelector('.clock-num');
  const unitEl=partEl.querySelector('.clock-unit');
  unitEl.textContent=plural(value,forms);

  if(prevVals[key]===null){
    const startVal=value>0?Math.max(0,value-Math.min(value,15)):0;
    rollNumber(numEl,startVal,value,1350,delay);
    prevVals[key]=value;
  }else if(prevVals[key]!==value){
    rollNumber(numEl,prevVals[key],value,750,0);
    prevVals[key]=value;
  }
}

function render(){
  const now=Date.now(),until=timestamp(config.liveUntil),live=config.status==='live'&&Number.isFinite(until)&&until>now,explicit=timestamp(config.nextStart),cancelled=config.status==='cancelled';
  const panel=el('live-panel'),clockEl=el('live-clock'),dateEl=el('live-date');
  panel.classList.toggle('is-live',live);
  el('live-label').hidden=!live;
  for(const key of Object.keys(defaults)){
    const link=el('watch-'+key);
    link.href=(live?validURL(config.links?.[key],hosts[key]):null)||defaults[key];
    link.hidden=false;
    document.querySelectorAll('[data-live-platform="'+key+'"]').forEach(other=>other.href=link.href);
  }
  if(!loaded)return;
  panel.hidden=false;
  panel.classList.remove('is-loading');

  selectedStart=!live&&!cancelled?(Number.isFinite(explicit)?(explicit>now?explicit:null):regularNext(now)):null;
  const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  const today=selectedStart!==null&&dayKey(selectedStart)===dayKey(now);
  panel.classList.toggle('is-today',today);
  el('live-title').querySelector('span:last-child').textContent=live?'Сейчас в эфире!':today?'Сегодня поём!':'До нашего эфира';
  clockEl.hidden=!selectedStart;
  dateEl.hidden=false;

  if(live){
    clockEl.innerHTML='';
    prevVals.d=prevVals.h=prevVals.m=null;
    dateEl.textContent=config.title||'Присоединяйтесь к музыкальному вечеру!';
    return;
  }
  if(!selectedStart){
    clockEl.innerHTML='';
    prevVals.d=prevVals.h=prevVals.m=null;
    dateEl.textContent='Следите за анонсами ближайшего эфира в Telegram.';
    return;
  }

  const total=Math.max(0,Math.ceil((selectedStart-now)/60000)),d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;
  const items=[
    d?{key:'d',val:d,forms:['день','дня','дней']}:null,
    (d||h)?{key:'h',val:h,forms:['час','часа','часов']}:null,
    {key:'m',val:m,forms:['минута','минуты','минут']}
  ].filter(Boolean);

  const activeKeys=new Set(items.map(it=>it.key));
  clockEl.querySelectorAll('.clock-part').forEach(node=>{
    if(!activeKeys.has(node.dataset.unit)){
      prevVals[node.dataset.unit]=null;
      node.remove();
    }
  });

  items.forEach((it,idx)=>syncPart(clockEl,it.key,it.val,it.forms,idx*160));
  dateEl.textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(selectedStart)+' (МСК)';
}

async function refresh(){
  try{
    const response=await fetch('./live.json',{cache:'no-store'});
    if(response.ok){
      const data=await response.json();
      if(data&&typeof data==='object'&&!Array.isArray(data))config=data;
    }
  }catch{}finally{
    if(!loaded){
      loaded=true;
      render();
    }else{
      render();
    }
  }
}

setTimeout(()=>{if(!loaded){loaded=true;render()}},1500);
refresh();setInterval(render,1000);setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh()}});
})();