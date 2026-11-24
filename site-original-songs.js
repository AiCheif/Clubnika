/* Shared original-song section for the home and about pages. */
(()=>{
 const script=document.currentScript;
 script.insertAdjacentHTML('beforebegin',`<section class="profile-card" id="my-music">
  <div class="eyebrow">МОЁ ТВОРЧЕСТВО</div><h2>Авторские песни</h2>
  <p>В каждой песне — частичка моей души. Выберите любимую композицию и послушайте её на удобной площадке.</p>
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
  <div class="original-home-actions">
    <a class="outline" href="shorts.html?type=original"><svg class="youtube-button-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033"/><path d="m10 8 6 4-6 4z" fill="#fff"/></svg><span>Сниппеты моих песен</span></a>
    <a class="outline" href="originals.html"><svg class="original-action-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h13M3 10h9M3 15h6M17 17V5l4 2v3"/><ellipse cx="14.5" cy="17" rx="2.5" ry="2"/></svg><span>Все авторские песни</span></a>
    <a class="outline original-new-release" href="release.html"><span class="original-action-icon" aria-hidden="true">✦</span><span>Новый релиз</span></a>
  </div>
</section>`);
 document.querySelectorAll('#original-chips [data-song]').forEach(a=>{
   const url=window.NikaSiteConfig?.originalSongLinks?.[a.dataset.song];
   if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}
 });
})();
