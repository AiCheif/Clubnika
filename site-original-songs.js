/* Shared original-song section for the home and about pages. */
(()=>{
 const script=document.currentScript;
 script.insertAdjacentHTML('beforebegin',`<section class="profile-card" id="my-music">
  <svg class="original-watermark" viewBox="0 0 220 96" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
    <path d="M8 26c58-16 128 14 204-8M8 40c58-16 128 14 204-8M8 54c58-16 128 14 204-8M8 68c58-16 128 14 204-8"/>
    <ellipse cx="66" cy="54" rx="6.5" ry="4.5" transform="rotate(-18 66 54)" fill="currentColor" stroke="none"/>
    <path d="M72 53V22l22-5v29" stroke-width="1.6"/>
    <ellipse cx="88" cy="48" rx="6.5" ry="4.5" transform="rotate(-18 88 48)" fill="currentColor" stroke="none"/>
    <ellipse cx="152" cy="40" rx="6.5" ry="4.5" transform="rotate(-18 152 40)" fill="currentColor" stroke="none"/>
    <path d="M158 39V12c5 4 11 6 15 11" stroke-width="1.6"/>
  </svg>
  <div class="eyebrow">МОЁ ТВОРЧЕСТВО <span class="eq-bars is-playing" aria-hidden="true"><span></span><span></span><span></span></span></div><h2>Авторские песни</h2>
  <p>В каждой мелодии — частичка моей души. Выберите любимую композицию и послушайте её на удобной площадке.</p>
  <div id="original-chips" class="original-chips" aria-label="Авторские песни">
    <a class="outline" href="originals.html" data-song="Василёк">Василёк</a>
    <a class="outline" href="originals.html" data-song="Казачка">Казачка</a>
    <a class="outline" href="originals.html" data-song="Ласточка">Ласточка</a>
    <a class="outline" href="originals.html" data-song="Люли">Люли</a>
    <a class="outline" href="originals.html" data-song="Неси меня река">Неси меня река</a>
    <a class="outline" href="originals.html" data-song="Парень удалой">Парень удалой</a>
    <a class="outline" href="originals.html#pismetso">Письмецо</a>
    <a class="outline" href="originals.html" data-song="Чужой">Чужой</a>
    <a class="outline" href="originals.html" data-song="Вольный ветер">Вольный ветер</a>
    <a class="outline" href="originals.html" data-song="Вороны">Вороны</a>
  </div>
  <div class="program-divider" aria-hidden="true"><span></span><b>✦</b><span></span></div>
  <div class="original-home-actions">
    <a class="outline" href="shorts.html?type=original"><svg class="youtube-button-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033"/><path d="m10 8 6 4-6 4z" fill="#fff"/></svg><span>Слушать отрывки</span></a>
    <a class="outline" href="originals.html"><svg class="original-action-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h13M3 10h9M3 15h6M17 17V5l4 2v3"/><ellipse cx="14.5" cy="17" rx="2.5" ry="2"/></svg><span>Весь каталог</span></a>
  </div>
</section>`);
 document.querySelectorAll('#original-chips [data-song]').forEach(a=>{
   const url=window.NikaSiteConfig?.originalSongLinks?.[a.dataset.song];
   if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}
 });
})();