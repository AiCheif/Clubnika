(()=>{
  const mount=document.currentScript;
  if(!window.nikaViewerComments?.length)return;
  mount.insertAdjacentHTML("beforebegin",`<div class="viewer-quote" id="viewer-quote" hidden>
      <span class="quote-deco-mark" aria-hidden="true">“</span>
      <div class="viewer-quote-head">
        <span class="viewer-quote-label">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          ДОБРЫЕ СЛОВА ЗРИТЕЛЕЙ
        </span>
        <div class="viewer-quote-actions">
          <button type="button" id="quote-next" aria-label="Следующий комментарий" title="Следующий комментарий">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </button>
          <button type="button" id="quote-toggle" aria-label="Приостановить смену комментариев" title="Приостановить смену комментариев">
            <svg id="quote-icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            <svg id="quote-icon-play" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" hidden><path d="M7 4.5v15l12-7.5z"/></svg>
          </button>
        </div>
      </div>
      <blockquote id="quote-text"></blockquote>
      <a id="quote-source" href="https://www.youtube.com/@nikamoiseeva/streams" target="_blank" rel="noopener noreferrer"></a>
      <svg class="quote-float-heart" id="quote-float-heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </div>`);
  if(mount.hasAttribute("data-show-support"))document.getElementById("viewer-quote").insertAdjacentHTML("beforeend",`<a class="quote-support-link" href="support.html">♡ Оставить своё доброе слово</a>`);
  const list=window.nikaViewerComments||[],
        card=document.getElementById('viewer-quote'),
        quote=document.getElementById('quote-text'),
        source=document.getElementById('quote-source'),
        toggle=document.getElementById('quote-toggle'),
        nextBtn=document.getElementById('quote-next'),
        iconPause=document.getElementById('quote-icon-pause'),
        iconPlay=document.getElementById('quote-icon-play'),
        floatHeart=document.getElementById('quote-float-heart');
  if(!list.length||!card)return;

  const SLIDE_MS=6800;
  const HEART_LEAD_MS=1450;
  let index=Math.floor(Math.random()*list.length),
      paused=matchMedia('(prefers-reduced-motion: reduce)').matches,
      slideTimer,
      heartTimer;

  function clearTimers(){
    clearTimeout(slideTimer);
    clearTimeout(heartTimer);
  }

  function triggerHeart(){
    if(!floatHeart||paused)return;
    floatHeart.classList.remove('is-active');
    void floatHeart.offsetWidth;
    floatHeart.classList.add('is-active');
  }

  function setQuoteText(el,text){
    el.textContent='';
    const parts=String(text).split(/(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu);
    for(let i=0;i<parts.length;i++){
      if(!parts[i])continue;
      if(i%2===1){
        const span=document.createElement('span');
        span.className='emoji';
        span.textContent=parts[i];
        el.appendChild(span);
      }else{
        el.appendChild(document.createTextNode(parts[i]));
      }
    }
  }
function formatQuoteText(raw){
    return String(raw)
      .replace(/\s+/g,' ')
      .replace(/(\p{Extended_Pictographic}\uFE0F?)\1{3,}/gu,'$1$1$1')
      .trim();
  }

  function renderQuoteItem(c){
    setQuoteText(quote,formatQuoteText(c.text));
    source.textContent=c.author+' · YouTube';
    source.href='https://www.youtube.com/watch?v='+encodeURIComponent(c.video);
  }

  function syncQuoteHeight(){
    if(card.hidden||!list.length)return;
    card.style.minHeight='';
    const candidates=[...list]
      .sort((a,b)=>String(b.text).length-String(a.text).length)
      ;
    let maxH=0;
    for(const item of candidates){
      renderQuoteItem(item);
      if(card.offsetHeight>maxH)maxH=card.offsetHeight;
    }
    renderQuoteItem(list[index]);
    if(maxH>0)card.style.minHeight=maxH+'px';
  }

  function show(){
    if(floatHeart)floatHeart.classList.remove('is-active');
    renderQuoteItem(list[index]);
    card.classList.remove('quote-enter');
    void card.offsetWidth;
    card.classList.add('quote-enter');
  }
  function schedule(){
    clearTimers();
    if(paused||document.hidden)return;
    heartTimer=setTimeout(triggerHeart,Math.max(1000,SLIDE_MS-HEART_LEAD_MS));
    slideTimer=setTimeout(()=>{
      index=(index+1)%list.length;
      show();
      schedule();
    },SLIDE_MS);
  }

  function updateToggleUI(){
    if(iconPause)iconPause.hidden=paused;
    if(iconPlay)iconPlay.hidden=!paused;
    const label=paused?'Возобновить смену комментариев':'Приостановить смену комментариев';
    toggle.setAttribute('aria-label',label);
    toggle.title=label;
    schedule();
  }

  toggle.addEventListener('click',()=>{
    paused=!paused;
    updateToggleUI();
  });

  if(nextBtn){
    nextBtn.addEventListener('click',()=>{
      index=(index+1)%list.length;
      show();
      schedule();
    });
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)clearTimers();
    else schedule();
  });

  card.hidden=false;
  show();
  syncQuoteHeight();
  updateToggleUI();

  document.fonts?.ready.then(syncQuoteHeight);
  let lastWidth=window.innerWidth;
  window.addEventListener('resize',()=>{
    if(window.innerWidth!==lastWidth){
      lastWidth=window.innerWidth;
      syncQuoteHeight();
    }
  });
})();
