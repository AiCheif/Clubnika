/* Shared platform sections, footer and floating comment action. */
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
  script.insertAdjacentHTML('beforebegin',`<footer class="wrap"><span class="footer-brand"><span class="emoji">🍓</span> Ника Моисеева</span><span>С любовью к музыке · <a href="${config.sourceCatalog}" target="_blank" rel="noopener">Полный список песен</a></span><div class="footer-settings"><label class="theme-picker" for="theme-picker">Тема: <select id="theme-picker"><option value="scarlet">Алое золото</option><option value="berry">Клубничная</option><option value="emerald">Изумрудная</option><option value="sapphire">Сапфировая</option><option value="winter">Зимняя сказка</option></select></label></div></footer>`);
  if(!script.hasAttribute('data-hide-comment')){
    script.insertAdjacentHTML('beforebegin',"<a class="comment-float is-hidden" id="comment-float" href="support.html" aria-label="Оставить комментарий" title="Оставить комментарий"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2C7.4 17.7 4.2 14.3 4.2 10.3 4.2 7.5 6.3 5.6 8.8 5.6c1.4 0 2.5.6 3.2 1.6.7-1 1.8-1.6 3.2-1.6 2.5 0 4.6 1.9 4.6 4.7 0 4-3.2 7.4-7.8 10.9Z" fill="#e5243f" fill-opacity=".25" stroke="#9c1428" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 6.2c-.9-1.6-2.4-2.5-4.1-2.5M12 6.2c.9-1.6 2.4-2.5 4.1-2.5M12 6.2V3.2" fill="none" stroke="#2f6f3e" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.4" cy="10.8" r=".75" fill="#9c1428"/><circle cx="14.6" cy="10.8" r=".75" fill="#9c1428"/><circle cx="12" cy="13.6" r=".75" fill="#9c1428"/></svg><span>Оставить комментарий</span></a>");
    const button=document.getElementById('comment-float'),commentSection=document.getElementById('comment-section'),anchor=document.getElementById('my-music')||document.getElementById('translations')||commentSection;
    if(commentSection)button.href='#comment-section';
    const update=()=>{
      const show=anchor?anchor.getBoundingClientRect().top<=window.innerHeight*0.55:window.scrollY>=420;
      button.classList.toggle('is-hidden',!show);
    };
    addEventListener('scroll',update,{passive:true});addEventListener('resize',update);addEventListener('pageshow',update);requestAnimationFrame(update);
  }
  if(main.querySelector('[data-live-platform]')&&!document.getElementById('watch-youtube')){
    const allowed={youtube:['youtube.com','youtu.be'],twitch:['twitch.tv'],vkLive:['vkvideo.ru','vk.ru','vk.com']};
    const links=[...main.querySelectorAll('[data-live-platform]')];const defaults=new Map(links.map(link=>[link,link.href]));
    function safe(value,key){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed[key].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch{return null}}
    async function refresh(){try{const response=await fetch('./live.json',{cache:'no-store'});if(!response.ok)return;const data=await response.json(),live=data.status==='live'&&Date.parse(data.liveUntil)>Date.now();for(const link of links)link.href=(live?safe(data.links?.[link.dataset.livePlatform],link.dataset.livePlatform):null)||defaults.get(link)}catch{}}
    refresh();setInterval(refresh,60000);
  }
})();
