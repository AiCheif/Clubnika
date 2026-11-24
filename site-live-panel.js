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
script.insertAdjacentHTML('beforebegin',`<section class="site-live-panel" id="live-panel" aria-label="Ближайший эфир"><div class="eyebrow site-live-label" id="live-label" hidden>● ПРЯМОЙ ЭФИР</div><div class="site-live-heading"><h2 id="live-title"><span class="live-beacon" aria-hidden="true"></span><span>До нашего эфира</span></h2><div class="site-live-links" aria-label="Площадки трансляций">${links}</div></div><div class="site-live-clock" id="live-clock" hidden></div><p id="live-date">Уточняем дату ближайшего эфира…</p>${order}</section>`);
const el=id=>document.getElementById(id);
let config={},selectedStart=null;
function validURL(value,allowed){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch{return null}}
function timestamp(value){return typeof value==='string'&&/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)?Date.parse(value):NaN}
function regularNext(now){const moscow=new Date(now+3*3600000);for(let i=0;i<=7;i++){const day=new Date(Date.UTC(moscow.getUTCFullYear(),moscow.getUTCMonth(),moscow.getUTCDate()+i,16,30));if([2,6].includes(day.getUTCDay())&&day.getTime()>now)return day.getTime()}return null}
function plural(n,forms){const a=n%100,b=n%10;return forms[a>=11&&a<=14?2:b===1?0:b>=2&&b<=4?1:2]}
function part(n,forms){return `<span class="clock-part"><strong class="clock-num">${n}</strong> <span class="clock-unit">${plural(n,forms)}</span></span>`}
function render(){
  const now=Date.now(),until=timestamp(config.liveUntil),live=config.status==='live'&&Number.isFinite(until)&&until>now,explicit=timestamp(config.nextStart),cancelled=config.status==='cancelled';
  el('live-panel').classList.toggle('is-live',live);
  el('live-label').hidden=!live;
  el('live-title').querySelector('span:last-child').textContent=live?'Сейчас в эфире!':'До нашего эфира';
  for(const key of Object.keys(defaults)){
    const link=el('watch-'+key);
    link.href=(live?validURL(config.links?.[key],hosts[key]):null)||defaults[key];
    link.hidden=false;
    document.querySelectorAll('[data-live-platform="'+key+'"]').forEach(other=>other.href=link.href);
  }
  selectedStart=!live&&!cancelled?(Number.isFinite(explicit)?(explicit>now?explicit:null):regularNext(now)):null;
  el('live-clock').hidden=!selectedStart;
  if(live){el('live-date').textContent=config.title||'Присоединяйтесь к музыкальному вечеру!';return}
  if(!selectedStart){el('live-date').textContent='Следите за анонсами ближайшего эфира в Telegram.';return}
  const total=Math.max(0,Math.ceil((selectedStart-now)/60000)),d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;
  el('live-clock').innerHTML=[
    d?part(d,['день','дня','дней']):'',
    h?part(h,['час','часа','часов']):'',
    part(m,['минута','минуты','минут'])
  ].filter(Boolean).join('<span class="clock-sep" aria-hidden="true">·</span>');
  el('live-date').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(selectedStart)+' (МСК)';
}
async function refresh(){try{const response=await fetch('./live.json',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data&&typeof data==='object'&&!Array.isArray(data)){config=data;render()}}catch{}}
render();refresh();setInterval(render,1000);setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh()}});
})();