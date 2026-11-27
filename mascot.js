/* Floating mascot dock, animations, drag-and-drop and quick menu. */
(() => {
  const currentScript = document.currentScript;
  const baseHref = currentScript?.src || location.href;

  const initMascot = () => {
    const body = document.body;
    const main = document.querySelector('main');
    if (!body || !main) return;

    const mode = currentScript?.dataset.mode || body.dataset.mascot || '';
    if (mode === 'off' || document.getElementById('mascot-dock')) return;

    const basePath = new URL('./', baseHref).pathname.replace(/\/+$/, '');
    const currentPath = location.pathname.replace(/\/+$/, '');
    const isHome = mode === 'home'
      || /^index\.html$/i.test(body.dataset.page || '')
      || currentPath === ''
      || currentPath === '/index.html'
      || currentPath === basePath
      || currentPath === `${basePath}/index.html`;

    const MASCOT_STORAGE_KEY = 'clubnika_mascot_id';
    const POS_STORAGE_KEY_V2 = 'clubnika_mascot_pos_v2';

    const FALLBACK_MENU = {
      enabled: true,
      showAfterScroll: 0,
      autoCloseMs: 10000,
      label: 'Меню Клубнички',
      mascot: { image: 'img/logo-ruby.png', video: '', alt: 'Клубничка' },
      items: [
        { enabled: true, title: 'Заказать песню', href: 'songs.html', icon: '🎵' },
        { enabled: true, title: 'Оставить комментарий', href: 'support.html', anchorOnPage: '#comment-section', icon: '💌' }
      ]
    };

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const safeHref = (raw, base = baseHref) => {
      if (typeof raw !== 'string') return null;
      const val = raw.replace(/[\x00-\x1f\x7f]/g, '').trim();
      if (!val) return null;
      if (val.startsWith('#')) return val;
      try {
        const parsed = new URL(val, base);
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return null;
        if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') return val;
        return parsed.href;
      } catch {
        return null;
      }
    };

    const isExternalUrl = href => {
      if (!href || href.startsWith('#')) return false;
      try {
        const parsed = new URL(href, location.href);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
          && parsed.origin !== location.origin;
      } catch {
        return false;
      }
    };

    const getViewportSize = () => ({
      width: document.documentElement.clientWidth || window.innerWidth,
      height: document.documentElement.clientHeight || window.innerHeight
    });

    const ac = new AbortController();
    const { signal } = ac;

    const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const isAnimOff = () => document.documentElement.dataset.anim === 'off'
      || (!document.documentElement.dataset.anim && reducedQuery.matches);

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = isIOS || /^((?!chrome|android).)*safari/i.test(ua);

    body.insertAdjacentHTML('beforeend', `
      <div class="mascot-dock is-hidden" id="mascot-dock">
        <div class="mascot-popover" id="mascot-popover" role="dialog" aria-label="Меню маскота" aria-hidden="true" hidden>
          <div class="mascot-screen" data-screen="main"></div>
          <div class="mascot-screen" data-screen="settings" hidden>
            <button type="button" class="mascot-back-btn" data-go="main">‹ Назад</button>
            <div class="footer-settings mascot-menu-settings">
              <label class="mascot-picker" for="mascot-picker"><span>Маскот</span>
                <select id="mascot-picker" aria-label="Выбор маскота"></select>
              </label>
            </div>
          </div>
        </div>
        <button type="button" class="mascot-trigger" id="mascot-trigger" aria-expanded="false" aria-controls="mascot-popover" aria-label="Открыть меню">
          <span class="mascot-media" id="mascot-media"></span>
          <span class="mascot-label" id="mascot-label">Меню</span>
        </button>
      </div>
    `);

    const dock = document.getElementById('mascot-dock');
    const trigger = document.getElementById('mascot-trigger');
    const popover = document.getElementById('mascot-popover');
    const mediaBox = document.getElementById('mascot-media');
    const labelBox = document.getElementById('mascot-label');
    const mainScreen = popover.querySelector('[data-screen="main"]');
    const settingsScreen = popover.querySelector('[data-screen="settings"]');
    const settingsSlot = settingsScreen.querySelector('.mascot-menu-settings');
    const mascotPickerLabel = settingsScreen.querySelector('.mascot-picker');
    const mascotSelect = settingsScreen.querySelector('#mascot-picker');

    // Гарантируем работу pointer-перетаскивания на сенсорных экранах
    trigger.style.touchAction = 'none';

    const themeLabel = document.querySelector('footer.wrap .theme-picker');
    const themeHomeParent = themeLabel?.parentElement || null;

    const syncThemePickerLocation = dockVisible => {
      if (!themeLabel) return;
      if (dockVisible && settingsSlot && dock.isConnected) {
        if (themeLabel.parentElement !== settingsSlot) settingsSlot.append(themeLabel);
      } else {
        const fallbackParent = themeHomeParent?.isConnected
          ? themeHomeParent
          : document.querySelector('footer.wrap .footer-settings');
        if (fallbackParent && themeLabel.parentElement !== fallbackParent) {
          fallbackParent.append(themeLabel);
        }
      }
    };

    let isOpen = false;
    let isReady = false;
    let videoEl = null;
    let scrollThreshold = FALLBACK_MENU.showAfterScroll;
    let animations = {};
    let idleTimer = 0, playToken = 0, playing = false, greeted = false;
    let contextTimer = 0, closeTimer = 0, dragResetTimer = 0, rafId = 0;
    let autoCloseMs = FALLBACK_MENU.autoCloseMs;
    let resizeObserver = null;
    const playedContexts = new Set();

    const contexts = isHome ? [
      ['#live-panel', 'check-time'],
      ['.hero .photo-gallery', 'admire'],
      ['.site-tv-card', 'applause'],
      ['#translations', 'watch-shorts'],
      ['#my-music', 'sing']
    ].map(([selector, name]) => ({ element: main.querySelector(selector), name })).filter(x => x.element) : [];

    let cachedSavedPos = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(POS_STORAGE_KEY_V2) || 'null');
      if (parsed && typeof parsed.left === 'number' && Number.isFinite(parsed.left)
          && typeof parsed.top === 'number' && Number.isFinite(parsed.top)) {
        cachedSavedPos = { left: parsed.left, top: parsed.top };
      }
    } catch {}

    const DRAG_THRESHOLD = 6;
    const EDGE_MARGIN = 12;
    let isDragging = false;
    let wasDragged = false;
    let activePointerId = null;
    let hasCustomPos = false;
    let currentLeft = 0, currentTop = 0;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    const applyDockPosition = (left, top, save = false) => {
      const w = trigger.offsetWidth;
      const h = trigger.offsetHeight;
      if (!w || !h) return;

      const { width: vw, height: vh } = getViewportSize();
      const maxLeft = Math.max(EDGE_MARGIN, vw - w - EDGE_MARGIN);
      const maxTop = Math.max(EDGE_MARGIN, vh - h - EDGE_MARGIN);
      currentLeft = Math.min(Math.max(EDGE_MARGIN, left), maxLeft);
      currentTop = Math.min(Math.max(EDGE_MARGIN, top), maxTop);
      hasCustomPos = true;

      dock.classList.toggle('is-top', currentTop + h / 2 < vh / 2);
      dock.classList.toggle('is-left', currentLeft + w / 2 < vw / 2);

      // Компенсируем внутреннее смещение кнопки, только если dock является её offsetParent
      const innerOffsetLeft = trigger.offsetParent === dock ? trigger.offsetLeft : 0;
      const innerOffsetTop = trigger.offsetParent === dock ? trigger.offsetTop : 0;

      dock.style.left = `${currentLeft - innerOffsetLeft}px`;
      dock.style.top = `${currentTop - innerOffsetTop}px`;
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';

      if (save) {
        cachedSavedPos = { left: currentLeft, top: currentTop };
        try { localStorage.setItem(POS_STORAGE_KEY_V2, JSON.stringify(cachedSavedPos)); } catch {}
      }
    };

    const restoreSavedPosition = () => {
      const target = cachedSavedPos || (hasCustomPos ? { left: currentLeft, top: currentTop } : null);
      if (target) {
        applyDockPosition(target.left, target.top, false);
      }
    };

    const isSelectFocused = () => dock.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT';
    const hasOpenDialog = () => Boolean(document.querySelector('dialog[open]'));
    const canAnimateBase = () => Boolean(
      !signal.aborted
      && videoEl
      && !isAnimOff()
      && !document.hidden
      && !dock.classList.contains('is-hidden')
      && !isDragging
    );
    const canAnimate = () => canAnimateBase() && !hasOpenDialog();

    const scheduleContext = () => {
      clearTimeout(contextTimer);
      contextTimer = 0;
      if (signal.aborted || !isReady) return;

      const { height } = getViewportSize();
      for (const { element, name } of contexts) {
        const rect = element.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
        if (overlap <= Math.min(rect.height, height) * 0.15) playedContexts.delete(name);
      }
      if (!contexts.length || !canAnimate() || isOpen || playing) return;
      contextTimer = setTimeout(() => {
        contextTimer = 0;
        if (!canAnimate() || isOpen || playing) return;
        const { height: h } = getViewportSize();
        const visible = contexts
          .filter(({ name }) => animations[name] && !playedContexts.has(name))
          .map(context => {
            const rect = context.element.getBoundingClientRect();
            const overlap = Math.min(rect.bottom, h) - Math.max(rect.top, 0);
            return { ...context, overlap, required: Math.min(rect.height, h) * 0.45 };
          })
          .filter(x => x.overlap > 0 && x.overlap >= x.required)
          .sort((a, b) => b.overlap - a.overlap);

        if (visible.length) {
          playedContexts.add(visible[0].name);
          playAnimation(visible[0].name);
        }
      }, 650);
    };

    const stopAnimation = () => {
      clearTimeout(idleTimer);
      idleTimer = 0;
      playToken++;
      playing = false;
      if (videoEl) {
        videoEl.pause();
        if (Object.keys(animations).length) videoEl.hidden = true;
      }
    };

    const scheduleIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = 0;
      if (!canAnimateBase() || isOpen) return;
      idleTimer = setTimeout(() => {
        idleTimer = 0;
        if (signal.aborted || isOpen) return;
        if (!canAnimate()) {
          // Если мешает только открытый <dialog>, перепланируем проверку
          if (canAnimateBase() && hasOpenDialog()) scheduleIdle();
          return;
        }
        const choices = ['wink', 'thumbs-up', 'salute'].filter(name => animations[name]);
        if (animations.idle && (!choices.length || Math.random() < 0.5)) playAnimation('idle');
        else if (choices.length) playAnimation(choices[Math.floor(Math.random() * choices.length)]);
      }, 15000 + Math.random() * 20000);
    };

    const playAnimation = name => {
      if (!canAnimate() || !animations[name]) return;
      stopAnimation();
      const token = playToken;
      playing = true;
      videoEl.src = animations[name];
      const finish = () => {
        if (token !== playToken) return;
        stopAnimation();
        if (signal.aborted) return;
        scheduleIdle();
        scheduleContext();
      };
      videoEl.onended = finish;
      videoEl.onerror = finish;
      videoEl.play().then(() => {
        if (token === playToken && !signal.aborted) videoEl.hidden = false;
      }).catch(finish);
    };

    const destroy = () => {
      if (signal.aborted) return;
      ac.abort();
      cancelAnimationFrame(rafId);
      rafId = 0;
      stopAnimation();
      clearTimeout(contextTimer);
      contextTimer = 0;
      clearTimeout(closeTimer);
      closeTimer = 0;
      clearTimeout(dragResetTimer);
      dragResetTimer = 0;
      resizeObserver?.disconnect();
      syncThemePickerLocation(false);
      dock.remove();
      delete window.ClubnikaMascot;
    };

    window.ClubnikaMascot = { destroy };

    const syncPlayback = () => {
      if (signal.aborted || !videoEl) return;
      if (Object.keys(animations).length) {
        if (!canAnimate()) stopAnimation();
        else if (!playing) {
          if (!greeted && animations.greeting) {
            greeted = true;
            playAnimation('greeting');
          }
          if (!playing && !idleTimer) scheduleIdle();
        }
        return;
      }
      if (isAnimOff() || document.hidden || dock.classList.contains('is-hidden')) {
        videoEl.pause();
      } else {
        videoEl.play().catch(() => {});
      }
    };

    const update = () => {
      if (signal.aborted || !isReady || isOpen) return;
      const show = window.scrollY >= scrollThreshold;
      dock.classList.toggle('is-hidden', !show);
      syncThemePickerLocation(show);

      if (!Object.keys(animations).length) {
        syncPlayback();
        return;
      }
      if (!show) {
        stopAnimation();
        return;
      }
      if (canAnimate() && !playing && !greeted && animations.greeting) {
        greeted = true;
        playAnimation('greeting');
      }
      if (!playing && !idleTimer) scheduleIdle();
      scheduleContext();
    };

    const resetCloseTimer = () => {
      clearTimeout(closeTimer);
      closeTimer = 0;
      if (!signal.aborted && isOpen && autoCloseMs > 0) {
        closeTimer = setTimeout(() => {
          closeTimer = 0;
          if (signal.aborted) return;
          if (isSelectFocused()) { resetCloseTimer(); return; }
          setOpen(false);
        }, autoCloseMs);
      }
    };

    const showScreen = (name, { reposition = true, resetTimer = true } = {}) => {
      popover.querySelectorAll('.mascot-screen').forEach(s => {
        s.hidden = s.dataset.screen !== name;
      });
      if (reposition && hasCustomPos) restoreSavedPosition();
      if (resetTimer) resetCloseTimer();
    };

    const setOpen = next => {
      if (signal.aborted) return;
      isOpen = Boolean(next);
      if (!isOpen && popover.contains(document.activeElement)) {
        trigger.focus();
      }
      resetCloseTimer();
      trigger.setAttribute('aria-expanded', String(isOpen));
      popover.hidden = !isOpen;
      popover.setAttribute('aria-hidden', String(!isOpen));
      dock.classList.toggle('is-open', isOpen);
      if (!isOpen) {
        showScreen('main', { reposition: false, resetTimer: false });
      }
      if (hasCustomPos) restoreSavedPosition();
      if (isOpen) {
        playAnimation('invite');
      } else {
        playAnimation('salute');
        update();
      }
    };

    const renderFallbackVisual = alt => {
      stopAnimation();
      videoEl = null;
      animations = {};
      dock.classList.remove('has-animated-mascot');
      const fallbackImg = safeHref(FALLBACK_MENU.mascot.image);
      if (fallbackImg) {
        mediaBox.innerHTML = `<img src="${esc(fallbackImg)}" alt="${esc(alt)}" width="64" height="64">`;
        const fbEl = mediaBox.querySelector('img');
        if (fbEl) fbEl.onerror = () => { mediaBox.textContent = '🍓'; };
      } else {
        mediaBox.textContent = '🍓';
      }
    };

    const applyMascot = m => {
      if (signal.aborted) return;
      stopAnimation();
      greeted = false;
      playedContexts.clear();
      videoEl = null;
      dock.classList.remove('has-animated-mascot');
      mediaBox.innerHTML = '';

      const imgSrc = safeHref(m?.image);
      const vidSrc = safeHref(m?.video);
      const altText = m?.alt || m?.name || '';
      animations = Object.fromEntries(
        Object.entries(m?.animations || {})
          .map(([name, src]) => [name, safeHref(src)])
          .filter(([, src]) => src)
      );

      if (imgSrc && Object.keys(animations).length) {
        dock.classList.add('has-animated-mascot');
        mediaBox.innerHTML = `<img src="${esc(imgSrc)}" alt="" width="384" height="384">${isSafari ? '' : '<video muted playsinline preload="none" hidden aria-hidden="true"></video>'}`;
        videoEl = mediaBox.querySelector('video');
      } else if (vidSrc && !isSafari) {
        mediaBox.innerHTML = `<video src="${esc(vidSrc)}" autoplay loop muted playsinline ${imgSrc ? `poster="${esc(imgSrc)}"` : ''} aria-hidden="true"></video>`;
        videoEl = mediaBox.querySelector('video');
        videoEl.onerror = () => {
          videoEl = null;
          if (imgSrc) {
            mediaBox.innerHTML = `<img src="${esc(imgSrc)}" alt="${esc(altText)}" width="64" height="64">`;
            const fbImgEl = mediaBox.querySelector('img');
            if (fbImgEl) fbImgEl.onerror = () => renderFallbackVisual(altText);
          } else {
            renderFallbackVisual(altText);
          }
        };
        syncPlayback();
      } else if (imgSrc) {
        mediaBox.innerHTML = `<img src="${esc(imgSrc)}" alt="${esc(altText)}" width="64" height="64">`;
      } else {
        renderFallbackVisual(altText);
      }

      const imgEl = mediaBox.querySelector('img');
      if (imgEl) {
        imgEl.onerror = () => renderFallbackVisual(altText);
      }
    };

    const renderMenu = cfg => {
      if (signal.aborted) return;

      const items = (Array.isArray(cfg?.items) ? cfg.items : []).filter(it => it && it.enabled !== false && it.title);
      if (!cfg || cfg.enabled === false || !items.length) {
        destroy();
        return;
      }

      scrollThreshold = typeof cfg.showAfterScroll === 'number' && Number.isFinite(cfg.showAfterScroll)
        ? Math.max(0, cfg.showAfterScroll)
        : FALLBACK_MENU.showAfterScroll;

      autoCloseMs = typeof cfg.autoCloseMs === 'number' && Number.isFinite(cfg.autoCloseMs)
        ? Math.max(0, cfg.autoCloseMs)
        : FALLBACK_MENU.autoCloseMs;

      if (cfg.label) {
        labelBox.textContent = cfg.label;
        trigger.setAttribute('aria-label', cfg.label);
        popover.setAttribute('aria-label', cfg.label);
      }

      const validMascots = Array.isArray(cfg.mascots)
        ? cfg.mascots.filter(x => x && typeof x === 'object')
        : [];
      const list = (validMascots.length
        ? validMascots
        : [{ id: 'default', name: cfg.mascot?.alt || 'Клубничка', ...(cfg.mascot || {}) }]
      ).map((x, idx) => ({
        ...x,
        id: x.id != null && String(x.id).trim() !== '' ? String(x.id) : `mascot-${idx}`
      }));

      let savedId = '';
      try { savedId = localStorage.getItem(MASCOT_STORAGE_KEY) || ''; } catch {}
      const currentMascot = list.find(x => x.id === savedId) || list[0];
      const hasMultiple = list.length > 1;

      if (mascotSelect) {
        mascotSelect.innerHTML = list.map(x => `<option value="${esc(x.id)}">${esc(x.name || x.id)}</option>`).join('');
        mascotSelect.value = currentMascot.id;
        mascotSelect.disabled = !hasMultiple;
        if (mascotPickerLabel) mascotPickerLabel.hidden = !hasMultiple;

        mascotSelect.onchange = () => {
          const next = list.find(x => x.id === mascotSelect.value) || list[0];
          try { localStorage.setItem(MASCOT_STORAGE_KEY, next.id); } catch {}
          applyMascot(next);
          if (isOpen) playAnimation('invite');
          else update();
        };
      }

      applyMascot(currentMascot);

      const linksMarkup = items.map(item => {
        const rawHref = safeHref(item.href);
        const pageAnchor = safeHref(item.anchorOnPage);
        let href = rawHref;
        if (pageAnchor && pageAnchor.length > 1 && pageAnchor.startsWith('#') && document.getElementById(pageAnchor.slice(1))) {
          href = pageAnchor;
        }
        const safeUrl = href || '#';
        const external = isExternalUrl(safeUrl);
        return `
          <a class="mascot-item" href="${esc(safeUrl)}"${!href ? ' data-noop="1"' : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
            ${item.icon ? `<span class="mascot-item-icon" aria-hidden="true">${esc(item.icon)}</span>` : ''}
            <span class="mascot-item-body">
              <span class="mascot-item-title">${esc(item.title)}${item.badge ? `<span class="mascot-item-badge">${esc(item.badge)}</span>` : ''}</span>
              ${item.subtitle ? `<small class="mascot-item-sub">${esc(item.subtitle)}</small>` : ''}
            </span>
          </a>
        `;
      }).join('');

      const hasSettings = hasMultiple || Boolean(themeLabel);
      const settingsBtnMarkup = hasSettings ? `
        <button type="button" class="mascot-item mascot-nav-btn" data-go="settings">
          <span class="mascot-item-icon" aria-hidden="true">⚙️</span>
          <span class="mascot-item-body"><span class="mascot-item-title">Настройки</span></span>
          <span class="mascot-item-arrow" aria-hidden="true">›</span>
        </button>
      ` : '';

      mainScreen.innerHTML = `${linksMarkup}${settingsBtnMarkup}`;

      isReady = true;
      update();
      restoreSavedPosition();

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (signal.aborted) return;
        update();
        restoreSavedPosition();
      });
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (hasCustomPos && !isDragging) restoreSavedPosition();
      });
      resizeObserver.observe(trigger);
    }

    trigger.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (isDragging) return;
      const rect = trigger.getBoundingClientRect();
      clearTimeout(dragResetTimer);
      dragResetTimer = 0;
      isDragging = true;
      wasDragged = false;
      activePointerId = e.pointerId;
      clearTimeout(idleTimer);
      idleTimer = 0;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      try { trigger.setPointerCapture(e.pointerId); } catch {}
    });

    trigger.addEventListener('pointermove', e => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!wasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        wasDragged = true;
        dock.classList.add('is-dragging');
        if (isOpen) setOpen(false);
      }

      if (wasDragged) {
        applyDockPosition(startLeft + dx, startTop + dy, false);
      }
    });

    const endDrag = (e, cancelled = false) => {
      if (!isDragging || (e && e.pointerId !== activePointerId)) return;
      const pointerId = activePointerId;
      isDragging = false;
      activePointerId = null;
      dock.classList.remove('is-dragging');
      if (pointerId != null && trigger.hasPointerCapture?.(pointerId)) {
        try { trigger.releasePointerCapture(pointerId); } catch {}
      }
      if (wasDragged && hasCustomPos && !cancelled) {
        applyDockPosition(currentLeft, currentTop, true);
      }
      clearTimeout(dragResetTimer);
      dragResetTimer = 0;
      if (cancelled) {
        wasDragged = false;
      } else if (wasDragged) {
        dragResetTimer = setTimeout(() => {
          dragResetTimer = 0;
          wasDragged = false;
        }, 100);
      }
      if (!isOpen && !playing) {
        scheduleIdle();
        scheduleContext();
      }
    };

    trigger.addEventListener('pointerup', e => endDrag(e, false));
    trigger.addEventListener('pointercancel', e => endDrag(e, true));
    trigger.addEventListener('lostpointercapture', e => endDrag(e, true));

    trigger.addEventListener('click', e => {
      if (wasDragged && e.detail !== 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        clearTimeout(dragResetTimer);
        dragResetTimer = 0;
        wasDragged = false;
        return;
      }
      wasDragged = false;
      setOpen(!isOpen);
    });

    trigger.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' && !isOpen && !playing && greeted && !isDragging) {
        playAnimation('wink');
      }
    });

    const closeOutside = e => {
      if (!isOpen) return;
      const target = e.target instanceof Node ? e.target : e.target?.parentNode;
      if (target && !dock.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, { capture: true, signal });
    document.addEventListener('touchstart', closeOutside, { capture: true, passive: true, signal });

    dock.addEventListener('pointerdown', resetCloseTimer);
    popover.addEventListener('focusin', resetCloseTimer);
    popover.addEventListener('pointermove', resetCloseTimer);
    popover.addEventListener('change', resetCloseTimer);

    document.addEventListener('change', e => {
      if (e.target?.id === 'theme-picker') playAnimation('theme-change');
    }, { signal });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen && !isSelectFocused()) {
        setOpen(false);
        trigger.focus();
      }
    }, { signal });

    popover.addEventListener('click', e => {
      const navBtn = e.target.closest('[data-go]');
      if (navBtn) {
        e.stopPropagation();
        showScreen(navBtn.dataset.go);
        return;
      }
      const link = e.target.closest('a');
      if (link) {
        if (link.dataset.noop) e.preventDefault();
        setOpen(false);
      }
    });

    const handleAnimStateChange = () => {
      syncPlayback();
      scheduleContext();
    };
    document.addEventListener('visibilitychange', handleAnimStateChange, { signal });
    document.addEventListener('clubnika:animchange', handleAnimStateChange, { signal });
    reducedQuery.addEventListener?.('change', handleAnimStateChange, { signal });

    addEventListener('scroll', () => {
      if (isOpen) {
        if (isSelectFocused()) return;
        setOpen(false);
      } else {
        update();
        if (!hasCustomPos) restoreSavedPosition();
      }
    }, { passive: true, signal });

    addEventListener('resize', () => {
      if (!isOpen) update();
      if (hasCustomPos) restoreSavedPosition();
    }, { signal });

    addEventListener('pageshow', () => {
      update();
      restoreSavedPosition();
    }, { signal });

    const menuUrl = new URL('./floating-menu.json', baseHref).href;
    fetch(menuUrl, { signal })
      .then(r => (r.ok ? r.json() : FALLBACK_MENU))
      .then(renderMenu)
      .catch(err => {
        if (!signal.aborted && err?.name !== 'AbortError') renderMenu(FALLBACK_MENU);
      });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMascot, { once: true });
  } else {
    initMascot();
  }
})();
