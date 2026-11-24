/* Clubnika custom events for Google Tag Manager. Clicks indicate intent, not completion. */
(()=>{
  if(window.NikaAnalytics)return;
  const page=location.pathname.split('/').pop()||'index.html';
  const enabled=location.protocol==='https:'&&new URLSearchParams(location.search).get('demo')!=='1';
  const names=new Set(['song_order','song_catalog_open','song_payment_click','watch_stream','leave_comment','comment_page_open','music_listen','presave','presave_interest','create_short','create_short_interest']);
  function track(event,params={}){
    if(!enabled||!names.has(event))return;
    const data={source_page:page};
    for(const key of ['platform','song_title','song_artist'])if(typeof params[key]==='string'&&params[key].trim())data[key]=params[key].trim().slice(0,100);
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({...data,event});
  }
  window.NikaAnalytics={track};
  function platform(url){const h=url.hostname.toLowerCase();if(h.includes('youtube.com')||h==='youtu.be')return 'youtube';if(h.endsWith('twitch.tv'))return 'twitch';if(h.includes('vkvideo.ru'))return 'vk_video';if(h.endsWith('vk.ru')||h.endsWith('vk.com'))return 'vk';if(h.endsWith('tiktok.com'))return 'tiktok';if(h.endsWith('t.me'))return 'telegram';if(h.endsWith('music.yandex.ru'))return 'yandex_music';if(h.endsWith('zvuk.com'))return 'zvuk';if(h.endsWith('music.mts.ru'))return 'kion_music';if(h.endsWith('music.apple.com'))return 'apple_music';if(h.endsWith('spotify.com'))return 'spotify';if(h.endsWith('band.link'))return 'bandlink';if(h.endsWith('donationalerts.com'))return 'donationalerts';if(h.endsWith('donatepay.ru'))return 'donatepay';if(h.endsWith('destream.net'))return 'destream';return h;}
  function click(e){
    const a=e.target?.closest?.('a[href]');if(!a)return;
    let url;try{url=new URL(a.href,location.href)}catch{return;}
    if(!['http:','https:'].includes(url.protocol))return;
    const p=platform(url),params={platform:p};
    if(a.matches('#order .pay')){track('song_payment_click',{...params,song_title:document.getElementById('orderTitle')?.textContent,song_artist:document.getElementById('orderArtist')?.textContent});return;}
    if(a.matches('[data-live-platform],#watch-youtube,#watch-twitch,#watch-vkLive')){const key=a.dataset.livePlatform||a.id.replace(/^watch-/,'');track('watch_stream',{platform:key==='vkLive'?'vk_video':key||p});return;}
    if(a.matches('#youtube-link,#vk-link')&&page==='support.html'){track('leave_comment',{platform:a.id==='youtube-link'?'youtube':'vk_video'});return;}
    if(a.id==='presave-link'){track(a.dataset.analyticsReady==='true'?'presave':'presave_interest',params);return;}
    if(a.matches('#youtube-sound,#tiktok-sound')){track(a.dataset.analyticsReady==='true'?'create_short':'create_short_interest',{platform:a.id==='youtube-sound'?'youtube':'tiktok'});return;}
    if(a.closest('#listen,#platform-links')||p==='bandlink'){track('music_listen',params);return;}
    if(url.origin===location.origin){const destination=url.pathname.split('/').pop();if(destination==='support.html'&&page!=='support.html'){track('comment_page_open');return;}if(destination==='songs.html'&&page!=='songs.html'){track('song_catalog_open');return;}}
  }
  document.addEventListener('click',click,true);
  document.addEventListener('auxclick',e=>{if(e.button===1)click(e)},true);
})();
