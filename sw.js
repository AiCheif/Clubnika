const CACHE='nika-catalog-pwa-v15';
const BASE=new URL('./',self.location.href);
const CORE=['./','./index.html','./songs.html','./about.html','./support.html','./release.html','./shorts.html','./shorts-data.js?v=5','./shorts.js?v=5','./remixes.html','./remixes.js?v=5','./remix-metrics.js?v=1','./remix-ranking.json','./remix-history.json','./authors.json','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./icon-maskable.png'];
const APP_PAGES=new Set(['./','./index.html','./songs.html','./about.html','./support.html','./release.html','./shorts.html','./remixes.html'].map(p=>new URL(p,BASE).pathname));
const relativeURL=p=>new URL(p,BASE).href;
async function cacheEntry(cache,url){try{const response=await fetch(url,{cache:'reload'});if(response.ok&&response.type!=='opaque')await cache.put(url,response)}catch{}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(CORE.map(p=>cacheEntry(cache,relativeURL(p))));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('nika-catalog-pwa-')&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type!=='CACHE_PAGE')return;let url;try{url=new URL(event.data.url);url.hash=''}catch{return}if(url.origin!==BASE.origin||!APP_PAGES.has(url.pathname))return;url.search='';event.waitUntil(caches.open(CACHE).then(cache=>cacheEntry(cache,url.href)))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(request.mode==='navigate'&&APP_PAGES.has(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);const key=new URL(url.href);key.search='';key.hash='';try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)await cache.put(key.href,response.clone());return response}catch{return await cache.match(key.href)||(!['./','./index.html'].some(p=>new URL(p,BASE).pathname===key.pathname)?null:await cache.match(relativeURL('./'))||await cache.match(relativeURL('./index.html')))||new Response('Нет подключения к интернету. Откройте сайт онлайн хотя бы один раз.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}})());
    return;
  }
  if(!['image','style','script','font','manifest'].includes(request.destination)&&!['./remix-ranking.json','./remix-history.json','./authors.json'].some(p=>url.pathname===new URL(p,BASE).pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request,{cache:request.destination==='script'||request.destination==='style'?'no-cache':'default'});if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response}catch{return await cache.match(request)||Response.error()}})());
});
