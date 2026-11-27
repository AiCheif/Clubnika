/* ==========================================================================
   Clubnika — Компонент «Сигны с эфиров» на главной странице (site-home-signs.js)
   Подключается внутри контейнера .home-feature-pair.
   Автоматически листает сигны по одной при включённом режиме анимаций.
   ========================================================================== */
(() => {
  'use strict';

  const hostScript = document.currentScript;
  const AUTOPLAY_MS = Math.max(1500, Number(hostScript?.dataset?.interval) || 4500);

  const reducedQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  const isAnimDisabled = () =>
    document.documentElement.dataset.anim === 'off' ||
    (!document.documentElement.dataset.anim && Boolean(reducedQuery?.matches));

  const noun = (n, forms) =>
    forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];

  const formatDate = dateStr =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    })
      .format(new Date(`${dateStr}T00:00:00Z`))
      .replace(/\s*г\.$/, '');

  const esc = v =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureSignAlbums() {
    if (Array.isArray(window.SIGN_ALBUMS)) return window.SIGN_ALBUMS;
    try {
      await loadScriptOnce('signs/data.js');
      await loadScriptOnce('signs/albums.js');
    } catch (err) {
      console.warn('[site-home-signs]', err);
    }
    return Array.isArray(window.SIGN_ALBUMS) ? window.SIGN_ALBUMS : [];
  }

  function createSectionElement() {
    const existing = document.getElementById('home-signs');
    if (existing) return existing;

    const section = document.createElement('section');
    section.className = 'feature-section home-signs-section';
    section.id = 'home-signs';
    section.hidden = true;
    section.setAttribute('aria-label', 'Сигны для зрителей');

    section.innerHTML = `
      <div class="sectionhead">
        <div>
          <div class="eyebrow">КЛУБНИЧНАЯ СЕМЬЯ</div>
          <h2>Сигны с эфиров</h2>
          <p>Тёплые фото-приветы для зрителей. Нажмите на карточку, чтобы открыть альбом.</p>
        </div>
        <button type="button" class="outline home-signs-shuffle" id="home-signs-shuffle">
          <span class="home-signs-shuffle-icon" aria-hidden="true">↻</span>
          <span>Другая сигна</span>
        </button>
      </div>

      <div class="home-signs-carousel" id="home-signs-carousel" aria-label="Карусель сигн с эфиров">
        <div class="home-signs-viewport" id="home-signs-viewport" tabindex="0" role="region" aria-roledescription="carousel">
          <div class="home-signs-track" id="home-signs-grid"></div>
        </div>
      </div>

      <div class="home-signs-footer">
        <small id="home-signs-meta"></small>
        <a class="outline" href="signs.html">Все альбомы сигн ↗</a>
      </div>
    `;

    if (hostScript && hostScript.parentNode) {
      hostScript.parentNode.insertBefore(section, hostScript);
    } else {
      const targetPair = document.querySelectorAll('.home-feature-pair')[1] || document.querySelector('main');
      targetPair?.appendChild(section);
    }

    return section;
  }

  async function init() {
    const section = createSectionElement();
    if (!section) return;

    const rawAlbums = await ensureSignAlbums();
    const albums = rawAlbums.filter(
      a => a && a.date && Array.isArray(a.items) && a.items.length
    );

    const pool = [];
    for (const album of albums) {
      for (const item of album.items) {
        if (item && item.type === 'photo' && (item.poster || item.preview || item.original)) {
          pool.push({
            date: album.date,
            src: item.poster || item.preview || item.original
          });
        }
      }
    }

    if (!pool.length) return;

    const viewport = section.querySelector('#home-signs-viewport');
    const track = section.querySelector('#home-signs-grid');
    const meta = section.querySelector('#home-signs-meta');
    const shuffleBtn = section.querySelector('#home-signs-shuffle');
    if (!viewport || !track) return;

    let slides = [];
    let activeIndex = 0;
    let timer = null;

    function renderSlides(keepFirstDifferent = false) {
      const prevFirst = slides[0]?.src;
      slides = shuffled(pool);
      if (keepFirstDifferent && slides.length > 1 && slides[0].src === prevFirst) {
        [slides[0], slides[1]] = [slides[1], slides[0]];
      }

      track.innerHTML = slides
        .map((item, idx) => {
          const href = `signs.html#album-${encodeURIComponent(item.date)}`;
          const dateText = formatDate(item.date);
          return `
            <a class="home-sign-card" data-spotlight href="${esc(href)}">
              <span class="home-sign-thumb">
                <img src="${esc(item.src)}" alt="Сигна от ${esc(dateText)}" loading="${idx === 0 ? 'eager' : 'lazy'}" decoding="async">
              </span>
              <span class="home-sign-info">
                <span class="home-sign-date">${esc(dateText)}</span>
                <span class="home-sign-arrow" aria-hidden="true">↗</span>
              </span>
            </a>
          `;
        })
        .join('');

      activeIndex = 0;
      viewport.scrollLeft = 0;
      window.ClubnikaAnim?.refresh?.();
    }

    function stepTo(targetIdx, smooth = true) {
      if (slides.length <= 1) return;
      activeIndex = ((targetIdx % slides.length) + slides.length) % slides.length;
      const cardEl = track.children[activeIndex];
      if (cardEl) {
        viewport.scrollTo({
          left: cardEl.offsetLeft - track.offsetLeft,
          behavior: smooth && !isAnimDisabled() ? 'smooth' : 'auto'
        });
      }
    }

    function stopAutoplay() {
      clearInterval(timer);
      timer = null;
    }

    function startAutoplay() {
      stopAutoplay();
      if (isAnimDisabled() || document.hidden || slides.length <= 1) return;
      timer = setInterval(() => stepTo(activeIndex + 1, true), AUTOPLAY_MS);
    }

    if (meta) {
      const albumsWithPhotos = albums.filter(a => a.items.some(x => x && x.type === 'photo')).length;
      meta.textContent = `${pool.length} ${noun(pool.length, ['фото-сигна', 'фото-сигны', 'фото-сигн'])} в ${albumsWithPhotos} ${noun(albumsWithPhotos, ['альбоме', 'альбомах', 'альбомах'])}`;
    }

    if (pool.length <= 1 && shuffleBtn) {
      shuffleBtn.hidden = true;
    }

    shuffleBtn?.addEventListener('click', () => {
      shuffleBtn.classList.remove('is-spinning');
      void shuffleBtn.offsetWidth;
      shuffleBtn.classList.add('is-spinning');
      renderSlides(true);
      startAutoplay();
    });

    viewport.addEventListener('mouseenter', stopAutoplay);
    viewport.addEventListener('mouseleave', startAutoplay);
    viewport.addEventListener('focusin', stopAutoplay);
    viewport.addEventListener('focusout', startAutoplay);
    document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoplay() : startAutoplay()));
    document.addEventListener('clubnika:animchange', () => (isAnimDisabled() ? stopAutoplay() : startAutoplay()));
    reducedQuery?.addEventListener?.('change', () => (isAnimDisabled() ? stopAutoplay() : startAutoplay()));

    viewport.addEventListener('scroll', () => {
      const slideWidth = viewport.clientWidth;
      if (slideWidth > 0 && slides.length) {
        activeIndex = Math.min(
          slides.length - 1,
          Math.max(0, Math.round(viewport.scrollLeft / slideWidth))
        );
      }
    }, { passive: true });

    renderSlides(false);
    section.hidden = false;
    startAutoplay();
  }

  init();
})();