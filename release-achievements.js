(()=>{
  const goals=[
    {views:10000,name:'Клубничный старт',icon:'🍓'},
    {views:25000,name:'Набираем обороты',icon:'✨'},
    {views:50000,name:'Бронзовая клубничка',icon:'🥉'},
    {views:100000,name:'Серебряная клубничка',icon:'🥈'},
    {views:250000,name:'Золотая клубничка',icon:'🥇'},
    {views:500000,name:'Клубничный рекорд',icon:'🏆'}
  ];
  const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ru-RU').format(n);
  const board=$('release-achievements');if(!board)return;
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  const count=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?Math.floor(n):0;
  let previousViews=null,demoViews=0,demoVideos=0;
  const steps=goals.map(goal=>{const node=document.createElement('div');node.className='achievement-step';const medal=document.createElement('span');medal.className='achievement-medal';medal.textContent=goal.icon;const value=document.createElement('strong');value.textContent=fmt(goal.views);const name=document.createElement('small');name.textContent=goal.name;const status=document.createElement('span');status.className='achievement-step-status';node.append(medal,value,name,status);$('achievement-milestones').append(node);return {node,status,goal};});
  function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const sparks=$('achievement-sparks');sparks.replaceChildren();for(let i=0;i<20;i++){const e=document.createElement('i');e.textContent=i%3===0?'✦':'✧';const angle=i*2*Math.PI/20,radius=100+(i%4)*45;e.style.setProperty('--dx',Math.cos(angle)*radius+'px');e.style.setProperty('--dy',Math.sin(angle)*radius+'px');e.style.setProperty('--delay',(i%4)*.05+'s');sparks.append(e);}setTimeout(()=>sparks.replaceChildren(),1300);}
  function render(views,videos,animate=false){
    views=count(views);videos=count(videos);
    const current=goals.find(g=>views<g.views),last=[...goals].reverse().find(g=>views>=g.views),target=current||goals[goals.length-1];
    const percent=Math.min(100,views/target.views*100);
    $('achievement-views').textContent=fmt(views);$('achievement-videos').textContent=fmt(videos);
    $('achievement-goal').textContent=current?'Следующая цель: '+fmt(target.views):'Клубничный рекорд достигнут!';$('achievement-percent').textContent=Math.floor(percent)+'%';
    $('achievement-fill').style.width=percent+'%';const bar=$('achievement-progress');bar.setAttribute('aria-valuemax',String(target.views));bar.setAttribute('aria-valuenow',String(Math.min(views,target.views)));bar.setAttribute('aria-valuetext',fmt(views)+' из '+fmt(target.views)+' просмотров');
    $('achievement-caption').textContent=current?fmt(views)+' / '+fmt(target.views)+' · осталось '+fmt(target.views-views):fmt(views)+' просмотров · все цели пройдены!';
    for(const {node,status,goal} of steps){const earned=views>=goal.views,isCurrent=goal===current;node.classList.toggle('earned',earned);node.classList.toggle('current',isCurrent);status.textContent=earned?'✓ Достигнуто':isCurrent?'Текущая цель':'🔒 Впереди';}
    const crossed=previousViews!==null&&goals.some(g=>previousViews<g.views&&views>=g.views);previousViews=views;
    $('achievement-message').textContent=last?(current?'Ура! Вместе мы набрали '+fmt(last.views)+' просмотров!':'Ура! Мы достигли клубничного рекорда — '+fmt(last.views)+' просмотров!'):'Каждый ролик приближает нас к первой цели. Создадим её вместе!';
    if(animate&&crossed)celebrate();
  }
  function syncDemo(){const slider=$('achievement-slider'),views=$('achievement-demo-views'),videos=$('achievement-demo-videos');slider.value=String(Math.min(500000,demoViews));views.value=String(demoViews);videos.value=String(demoVideos);render(demoViews,demoVideos,true);}
  if(demo){$('achievement-demo').hidden=false;$('achievement-source').textContent='Тестовый режим — значения не сохраняются и не влияют на реальную статистику.';const slider=$('achievement-slider'),views=$('achievement-demo-views'),videos=$('achievement-demo-videos');slider.addEventListener('input',()=>{demoViews=count(Number(slider.value));syncDemo()});views.addEventListener('change',()=>{demoViews=count(Number(views.value));syncDemo()});videos.addEventListener('change',()=>{demoVideos=count(Number(videos.value));syncDemo()});$('achievement-next').addEventListener('click',()=>{demoViews=(goals.find(g=>g.views>demoViews)||goals[goals.length-1]).views;syncDemo()});$('achievement-reset').addEventListener('click',()=>{demoViews=0;demoVideos=0;syncDemo()});syncDemo();return;}
  async function load(){try{const response=await fetch('./remix-new-song-ranking.json',{cache:'no-cache'});if(!response.ok)throw Error('statistics');const data=await response.json();if(!data.stats||!Number.isFinite(data.stats.views)||!Number.isFinite(data.stats.videoCount))throw Error('statistics');render(data.stats.views,data.stats.videoCount);$('achievement-source').textContent=Number.isFinite(Date.parse(data.updatedAt))?'Статистика YouTube на '+new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeZone:'Europe/Moscow'}).format(new Date(data.updatedAt)):'Статистика появится после публикации первых роликов.';}catch{$('achievement-source').textContent='Не удалось загрузить статистику. Попробуйте обновить страницу.';}}
  load();
})();
