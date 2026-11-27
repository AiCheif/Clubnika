/* Shared platform sections, footer and live links updater. */
(() => {
  const config = window.NikaSiteConfig, script = document.currentScript, main = document.querySelector('main');
  if (!config || !main) return;

  const titleOverrides = {
    'stream-platforms': 'Прямые эфиры',
    'listen': 'Музыка',
    'social': 'Соцсети'
  };

  const renderRow = section => {
    const title = titleOverrides[section.id] || section.title;
    const schedule = section.id === 'stream-platforms'
      ? '<p class="platform-schedule"><strong>Расписание:</strong> вт и сб в 19:30 (МСК)</p>'
      : '';
    return `<div class="platform-row" id="${section.id}"><div class="platform-row-head"><h2>${title}</h2>${schedule}</div><div class="platform-grid">${section.links.map(link => `<a class="platform-link" href="${link.href}" ${link.attrs}>${link.html}</a>`).join('')}</div></div>`;
  };

  const markup = `<section class="feature-section site-platforms-hub" aria-label="Площадки и соцсети">${config.platforms.map(renderRow).join('')}</section>`;
  const showPlatforms = !script.hasAttribute('data-hide-platforms');
  if (showPlatforms) main.insertAdjacentHTML('beforeend', markup);

  const themeMarkup = `
    <div class="footer-settings">
      <label class="theme-picker" for="theme-picker"><span>Тема</span>
        <select id="theme-picker" aria-label="Тема сайта">
          <option value="scarlet">Алое золото</option>
          <option value="berry">Клубничная</option>
          <option value="winter">Зимняя сказка</option>
          <option value="lavender">Лавандовая</option>
          <option value="honey">Медовая</option>
          <option value="lime">Лаймовая</option>
          <option value="coral">Коралловая</option>
        </select>
      </label>
    </div>
  `;

  script.insertAdjacentHTML('beforebegin', `
    <footer class="wrap">
      <div class="footer-info">
        <span class="footer-brand"><span class="emoji">🍓</span> Ника Моисеева</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <span>С любовью к музыке</span>
        <span class="footer-sep" aria-hidden="true">·</span>
        <button type="button" class="footer-share-btn" id="footer-share-btn">Поделиться</button>
      </div>
      ${themeMarkup}
    </footer>
  `);

  const shareBtn = document.getElementById('footer-share-btn');
  if (shareBtn) {
    let resetTimer = 0;
    shareBtn.addEventListener('click', async () => {
      const shareData = { title: document.title, url: location.href };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try { await navigator.share(shareData); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try {
        await navigator.clipboard.writeText(location.href);
        shareBtn.textContent = 'Ссылка скопирована ✓';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { shareBtn.textContent = 'Поделиться'; }, 2000);
      } catch {}
    });
  }

  if (main.querySelector('[data-live-platform]') && !document.getElementById('watch-youtube')) {
    const allowed = { youtube: ['youtube.com', 'youtu.be'], twitch: ['twitch.tv'], vkLive: ['vkvideo.ru', 'vk.ru', 'vk.com'] };
    const links = [...main.querySelectorAll('[data-live-platform]')];
    const defaults = new Map(links.map(link => [link, link.href]));

    function safe(value, key) {
      try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && allowed[key].some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : null;
      } catch {
        return null;
      }
    }

    async function refresh() {
      try {
        const response = await fetch('./live.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const live = data.status === 'live' && Date.parse(data.liveUntil) > Date.now();
        for (const link of links) {
          link.href = (live ? safe(data.links?.[link.dataset.livePlatform], link.dataset.livePlatform) : null) || defaults.get(link);
        }
      } catch {}
    }

    refresh();
    setInterval(refresh, 60000);
  }

  const quoteSource = document.getElementById('quote-source');
  if (quoteSource) {
    let busy = false, lastRaw = '';
    const buildBadge = () => {
      const tag = document.createElement('span');
      tag.className = 'quote-platform-tag';
      tag.setAttribute('aria-hidden', 'true');
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '1'); rect.setAttribute('y', '4');
      rect.setAttribute('width', '22'); rect.setAttribute('height', '16');
      rect.setAttribute('rx', '5'); rect.setAttribute('fill', '#e0002a');
      const poly = document.createElementNS(svgNS, 'path');
      poly.setAttribute('d', 'm10 8 6 4-6 4z'); poly.setAttribute('fill', '#fff');
      svg.append(rect, poly);
      tag.append(svg);
      return tag;
    };

    const enhanceSource = () => {
      if (busy) return;
      const nameEl = quoteSource.querySelector('.quote-author-name');
      const raw = ((nameEl ? nameEl.textContent : quoteSource.textContent) || '').replace(/\s*·\s*YouTube\s*$/i, '').trim();
      if (!raw || raw === lastRaw) return;
      busy = true;
      lastRaw = raw;
      const cleanName = raw.replace(/^@+/, '');
      const initial = (cleanName.match(/[\p{L}\p{N}]/u)?.[0] || 'Н').toUpperCase();
      quoteSource.setAttribute('aria-label', `${raw} — открыть на YouTube`);
      quoteSource.title = 'Открыть комментарий на YouTube';
      const av = document.createElement('span');
      av.className = 'quote-avatar'; av.setAttribute('aria-hidden', 'true'); av.textContent = initial;
      const nm = document.createElement('span');
      nm.className = 'quote-author-name'; nm.textContent = raw;
      quoteSource.replaceChildren(av, nm, buildBadge());
      queueMicrotask(() => { busy = false; });
    };

    enhanceSource();
    new MutationObserver(enhanceSource).observe(quoteSource, { childList: true, characterData: true, subtree: true });
  }
})();