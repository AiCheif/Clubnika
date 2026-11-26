/* Загрузка и рендеринг записей ВКонтакте и YouTube из news-posts.json */
(() => {
  'use strict';

  const DATA_URL = './news-posts.json';
  const PAGE_SIZE = 6;

  const grid = document.getElementById('news-grid');
  const statusEl = document.getElementById('news-status');
  const vkLink = document.getElementById('news-vk-link');
  const moreWrap = document.getElementById('news-more-wrap');
  const moreBtn = document.getElementById('news-more-btn');

  if (!grid || !statusEl) return;

  let allPosts = [];
  let renderedCount = 0;
  let vkApiPromise = null;

  const esc = v =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  function formatDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parsed = Date.parse(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
    if (!Number.isFinite(parsed)) return dateStr;
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    })
      .format(new Date(parsed))
      .replace(/\s*г\.$/, '');
  }

  function safeUrl(raw) {
    if (typeof raw !== 'string') return '';
    const val = raw.trim();
    if (!val || /^(javascript|data|vbscript):/i.test(val)) return '';
    return val;
  }

  function normalizePost(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;

    const kind = String(raw.type || '').toLowerCase();
    const url = safeUrl(raw.url);

    // 1. Запись сообщества YouTube (дата + уменьшенное фото)
    if (kind === 'youtube' || (!raw.ownerId && !raw.owner_id && !raw.embed && /youtube\.com|youtu\.be/i.test(url))) {
      const image = safeUrl(raw.image || raw.photo || raw.thumb);
      const postUrl = url || 'https://www.youtube.com/@nikamoiseeva/posts';
      if (!image) return null;

      return {
        type: 'youtube',
        key: `yt_${idx}`,
        image,
        date: formatDate(raw.date),
        url: postUrl
      };
    }

    // 2. Виджет поста ВКонтакте
    let ownerId = Number(raw.ownerId ?? raw.owner_id);
    let postId = Number(raw.postId ?? raw.post_id);
    let hash = typeof raw.hash === 'string' ? raw.hash.trim() : '';

    if ((!Number.isFinite(ownerId) || !Number.isFinite(postId) || !hash) && typeof raw.embed === 'string') {
      const m = raw.embed.match(/VK\.Widgets\.Post\(\s*['"][^'"]+['"]\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*['"]([^'"]+)['"]/);
      if (m) {
        ownerId = Number(m[1]);
        postId = Number(m[2]);
        hash = m[3].trim();
      }
    }

    if (!Number.isFinite(ownerId) || !Number.isFinite(postId) || !hash || hash.includes('ВСТАВЬТЕ_ХЭШ')) {
      return null;
    }

    return {
      type: 'vk',
      key: `${ownerId}_${postId}_${idx}`,
      ownerId,
      postId,
      hash,
      title: typeof raw.title === 'string' ? raw.title.trim() : '',
      date: formatDate(raw.date),
      url: `https://vk.com/wall${ownerId}_${postId}`
    };
  }

  function loadVkOpenApi() {
    if (window.VK?.Widgets?.Post) return Promise.resolve(window.VK);
    if (vkApiPromise) return vkApiPromise;

    vkApiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://vk.com/js/api/openapi.js?169';
      script.async = true;
      script.onload = () => {
        if (window.VK?.Widgets?.Post) resolve(window.VK);
        else reject(new Error('VK OpenAPI unavailable'));
      };
      script.onerror = () => reject(new Error('Failed to load VK OpenAPI'));
      document.head.append(script);
    });

    return vkApiPromise;
  }

  function mountWidget(post, containerId, frameEl) {
    if (frameEl.dataset.vkMounted === '1') return;
    frameEl.dataset.vkMounted = '1';

    loadVkOpenApi()
      .then(VK => {
        frameEl.innerHTML = `<div id="${esc(containerId)}"></div>`;
        VK.Widgets.Post(containerId, post.ownerId, post.postId, post.hash, {
          width: Math.max(260, Math.floor(frameEl.clientWidth || 480))
        });
      })
      .catch(() => {
        frameEl.innerHTML = `
          <div class="news-widget-placeholder">
            <span>Не удалось загрузить виджет ВКонтакте.</span>
            <a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer" style="color:#0077ff;font-weight:600;text-decoration:underline;">
              Открыть запись во ВКонтакте ↗
            </a>
          </div>
        `;
      });
  }

  const lazyObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const frame = entry.target;
          const post = frame._vkPost;
          if (post) mountWidget(post, frame.dataset.widgetId, frame);
          lazyObserver.unobserve(frame);
        }
      }, { rootMargin: '250px 0px' })
    : null;

  function renderYoutubeCard(post) {
    const article = document.createElement('article');
    article.className = 'news-card news-card--youtube';
    const altText = post.date ? `Запись в сообществе YouTube от ${post.date}` : 'Запись в сообществе YouTube';

    article.innerHTML = `
      <header class="news-card-head">
        <span class="news-card-source">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033"/><path d="m10 8 6 4-6 4z" fill="#fff"/></svg>
          <span>YouTube</span>
        </span>
        ${post.date ? `<time class="news-card-date">${esc(post.date)}</time>` : ''}
      </header>
      <a class="news-yt-stage" href="${esc(post.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(altText)}">
        <img class="news-yt-thumb" src="${esc(post.image)}" alt="${esc(altText)}" loading="lazy" decoding="async">
        <span class="news-yt-caption">Нажмите, чтобы открыть запись на YouTube</span>
      </a>
      <footer class="news-card-footer">
        <a class="news-card-link" href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a>
      </footer>
    `;

    return article;
  }

  function renderVkCard(post) {
    const widgetId = `vk_post_${post.key}`;
    const article = document.createElement('article');
    article.className = 'news-card news-card--vk';

    article.innerHTML = `
      <header class="news-card-head">
        ${post.title ? `<h2 class="news-card-title">${esc(post.title)}</h2>` : `<span class="news-card-source">ВКонтакте</span>`}
        ${post.date ? `<time class="news-card-date">${esc(post.date)}</time>` : ''}
      </header>
      <div class="news-widget-frame" data-widget-id="${esc(widgetId)}">
        <div class="news-widget-placeholder">Загрузка записи ВКонтакте…</div>
      </div>
      <footer class="news-card-footer">
        <a class="news-card-link" href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">Открыть во ВКонтакте ↗</a>
      </footer>
    `;

    const frameEl = article.querySelector('.news-widget-frame');
    frameEl._vkPost = post;

    if (lazyObserver) {
      lazyObserver.observe(frameEl);
    } else {
      mountWidget(post, widgetId, frameEl);
    }

    return article;
  }

  function renderBatch() {
    const slice = allPosts.slice(renderedCount, renderedCount + PAGE_SIZE);
    if (!slice.length) return;

    const fragment = document.createDocumentFragment();
    for (const post of slice) {
      fragment.append(post.type === 'youtube' ? renderYoutubeCard(post) : renderVkCard(post));
    }

    grid.append(fragment);
    renderedCount += slice.length;

    if (moreWrap) {
      moreWrap.hidden = renderedCount >= allPosts.length;
    }

    window.ClubnikaAnim?.refresh?.();
  }

  moreBtn?.addEventListener('click', renderBatch);

  fetch(DATA_URL, { cache: 'no-store' })
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data?.communityUrl && vkLink) {
        vkLink.href = data.communityUrl;
      }

      const rawList = Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : [];
      allPosts = rawList.map(normalizePost).filter(Boolean);

      if (!allPosts.length) {
        statusEl.innerHTML = `Пока здесь нет опубликованных записей. Все свежие новости доступны в <a href="${esc(vkLink?.href || 'https://vk.ru/nikamoiseevaa')}" target="_blank" rel="noopener noreferrer" style="color:var(--gold);text-decoration:underline;">сообществе ВКонтакте ↗</a>.`;
        statusEl.hidden = false;
        grid.hidden = true;
        return;
      }

      statusEl.hidden = true;
      grid.hidden = false;
      renderBatch();
    })
    .catch(() => {
      statusEl.textContent = 'Не удалось загрузить список новостей. Попробуйте обновить страницу.';
      statusEl.hidden = false;
    });
})();