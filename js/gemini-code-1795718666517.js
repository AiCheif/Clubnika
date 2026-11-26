/* ==========================================================================
   Clubnika — Единый контроллер анимаций, переходов и маскотов (js/site-anim.js)
   Безопасная модульная архитектура:
   - Каждый модуль изолирован в try/catch.
   - При data-anim="off" или сбое скрипт не скрывает контент и не блокирует клики.
   ========================================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'clubnika_anim_mode';
  const VALID_MODES = new Set(['full', 'soft', 'off']);
  const root = document.documentElement;
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function safeGetStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSetStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch {
      /* игнорируем ограничения приватного режима */
    }
  }

  function resolveInitialMode() {
    const saved = safeGetStorage(STORAGE_KEY);
    if (saved === 'off') return 'off';
    if (saved === 'soft' || saved === 'full') return 'soft';
    return reducedQuery && reducedQuery.matches ? 'off' : 'soft';
  }

  let currentMode = resolveInitialMode();
  root.dataset.anim = currentMode;
  root.classList.add('anim-ready');

  function setMode(nextMode, persist = true) {
    if (!VALID_MODES.has(nextMode)) return;
    currentMode = nextMode;
    root.dataset.anim = nextMode;
    if (persist) safeSetStorage(STORAGE_KEY, nextMode);

    if (nextMode === 'off') {
      document.querySelectorAll('[data-reveal], [data-stagger]').forEach(el => {
        el.classList.add('is-revealed', 'is-settled');
      });
      document.querySelectorAll('[data-mascot]').forEach(el => {
        el.classList.add('is-in');
        el.classList.remove('is-breathing');
      });
    }

    const toggle = document.getElementById('clubnika-anim-select');
    if (toggle) {
      if (toggle.type === 'checkbox') toggle.checked = nextMode !== 'off';
      else if (toggle.value !== nextMode) toggle.value = nextMode;
    }

    document.dispatchEvent(new CustomEvent('clubnika:animchange', { detail: { mode: nextMode } }));
  }

  if (reducedQuery && reducedQuery.addEventListener) {
    reducedQuery.addEventListener('change', e => {
      if (!safeGetStorage(STORAGE_KEY)) {
        setMode(e.matches ? 'off' : 'soft', false);
      }
    });
  }

  /* ------------------------------------------------------------------------
     1. Встраивание переключателя «Анимации» в блок настроек (.footer-settings)
     ------------------------------------------------------------------------ */
  function mountFooterControl(container) {
    if (!container || document.getElementById('clubnika-anim-select')) return true;

    const label = document.createElement('label');
    label.className = 'footer-anim-control';
    label.htmlFor = 'clubnika-anim-select';

    const title = document.createElement('span');
    title.textContent = 'Анимации';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'clubnika-anim-select';
    input.className = 'anim-switch-input';
    input.setAttribute('aria-label', 'Включить анимации сайта');
    input.checked = currentMode !== 'off';
    input.addEventListener('change', () => setMode(input.checked ? 'soft' : 'off', true));

    const slider = document.createElement('span');
    slider.className = 'anim-switch-slider';
    slider.setAttribute('aria-hidden', 'true');

    label.append(title, input, slider);
    container.append(label);
    return true;
  }

  function initFooterSetting() {
    try {
      const existing = document.querySelector('.footer-settings');
      if (mountFooterControl(existing)) return;

      if (!document.body) {
        document.addEventListener('DOMContentLoaded', initFooterSetting, { once: true });
        return;
      }

      const observer = new MutationObserver(() => {
        const target = document.querySelector('.footer-settings');
        if (mountFooterControl(target)) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 8000);
    } catch (err) {
      console.warn('[site-anim:footer]', err);
    }
  }

  /* ------------------------------------------------------------------------
     2. Круговая «волна» при переключении цветовой темы (View Transitions API)
     ------------------------------------------------------------------------ */
  let isTransitioningTheme = false;

  function runThemeWave(applyFn, originEl) {
    if (
      currentMode === 'off' ||
      isTransitioningTheme ||
      typeof document.startViewTransition !== 'function'
    ) {
      applyFn();
      return;
    }

    isTransitioningTheme = true;
    try {
      const rect = originEl && originEl.getBoundingClientRect
        ? originEl.getBoundingClientRect()
        : { left: window.innerWidth * 0.5, top: window.innerHeight * 0.92, width: 0, height: 0 };

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxR = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      root.style.setProperty('--wave-x', `${Math.round(x)}px`);
      root.style.setProperty('--wave-y', `${Math.round(y)}px`);
      root.style.setProperty('--wave-r', `${Math.ceil(maxR)}px`);
      root.classList.add('is-theme-switching');

      const transition = document.startViewTransition(() => {
        applyFn();
      });

      transition.finished.finally(() => {
        root.classList.remove('is-theme-switching');
        isTransitioningTheme = false;
      });
    } catch {
      root.classList.remove('is-theme-switching');
      isTransitioningTheme = false;
      applyFn();
    }
  }

  function initThemeWave() {
    try {
      const KNOWN_THEMES = new Set([
        'scarlet', 'pink', 'sky', 'blue', 'violet', 'purple',
        'chocolate', 'amber', 'emerald', 'green', 'dusty', 'rose', 'winter'
      ]);

      document.addEventListener('change', e => {
        const el = e.target;
        if (!(el instanceof HTMLSelectElement)) return;
        if (el.id === 'clubnika-anim-select' || el.dataset.waveBypass === '1') return;

        const isThemeSelect =
          el.dataset.setting === 'theme' ||
          /тема/i.test(el.getAttribute('aria-label') || '') ||
          KNOWN_THEMES.has(el.value);

        if (!isThemeSelect) return;
        if (currentMode === 'off' || typeof document.startViewTransition !== 'function') return;

        e.stopImmediatePropagation();
        runThemeWave(() => {
          el.dataset.waveBypass = '1';
          el.dispatchEvent(new Event('change', { bubbles: true }));
          delete el.dataset.waveBypass;
        }, el);
      }, true);
    } catch (err) {
      console.warn('[site-anim:theme-wave]', err);
    }
  }

  /* ------------------------------------------------------------------------
     3. Плавное появление секций ([data-reveal]) и каскад ([data-stagger])
     ------------------------------------------------------------------------ */
  let revealObserver = null;

  function settleElement(el, delayMs = 0) {
    setTimeout(() => {
      el.classList.add('is-settled');
    }, 680 + delayMs);
  }

  function prepareStagger(container) {
    const children = Array.from(container.children);
    children.forEach((child, idx) => {
      const delay = Math.min(idx * 45, 360);
      child.style.setProperty('--stagger-delay', `${delay}ms`);
    });
    return Math.min(children.length * 45, 360);
  }

  function revealNow(el) {
    if (el.classList.contains('is-revealed')) return;
    const extraDelay = el.hasAttribute('data-stagger') ? prepareStagger(el) : 0;
    el.classList.add('is-revealed');
    settleElement(el, extraDelay);
  }

  function initScrollReveal() {
    try {
      // Автоматически подключаем каскад для чипов авторских песен, если есть на странице
      const chips = document.getElementById('original-chips');
      if (chips && !chips.hasAttribute('data-stagger') && !chips.hasAttribute('data-no-reveal')) {
        chips.setAttribute('data-stagger', '');
      }

      // Автоматически размечаем основные секции ниже первого экрана
      const autoCandidates = document.querySelectorAll(
        'main > section, main > .site-platforms, main > .site-live-panel, main > .site-platform-pair'
      );
      const foldLimit = window.innerHeight * 0.72;

      autoCandidates.forEach(sec => {
        if (
          sec.hasAttribute('data-reveal') ||
          sec.hasAttribute('data-no-reveal') ||
          sec.classList.contains('hero')
        ) {
          return;
        }
        const top = sec.getBoundingClientRect().top;
        if (top > foldLimit) {
          sec.setAttribute('data-reveal', '');
        }
      });

      const targets = Array.from(document.querySelectorAll('[data-reveal], [data-stagger]'));
      if (!targets.length) return;

      if (currentMode === 'off' || !('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('is-revealed', 'is-settled'));
        return;
      }

      revealObserver = new IntersectionObserver(entries => {
        let batchIndex = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          if (!el.style.getPropertyValue('--reveal-delay')) {
            el.style.setProperty('--reveal-delay', `${Math.min(batchIndex * 60, 240)}ms`);
          }
          batchIndex++;
          revealNow(el);
          revealObserver.unobserve(el);
        }
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -28px 0px'
      });

      for (const el of targets) {
        revealObserver.observe(el);
      }

      // Страховочный таймер: ни один элемент не останется скрытым
      setTimeout(() => {
        for (const el of targets) {
          if (!el.classList.contains('is-revealed')) {
            revealNow(el);
            revealObserver?.unobserve(el);
          }
        }
      }, 2600);
    } catch (err) {
      console.warn('[site-anim:reveal]', err);
      document.querySelectorAll('[data-reveal], [data-stagger]').forEach(el => {
        el.classList.add('is-revealed', 'is-settled');
      });
    }
  }

  /* ------------------------------------------------------------------------
     4. Мобильный фокус карточки при прокрутке ([data-spotlight])
     ------------------------------------------------------------------------ */
  function initMobileSpotlight() {
    try {
      const isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;
      if (!isTouch || !('IntersectionObserver' in window)) return;

      const items = document.querySelectorAll('[data-spotlight]');
      if (!items.length) return;

      const spotObserver = new IntersectionObserver(entries => {
        if (currentMode === 'off') return;
        for (const entry of entries) {
          entry.target.classList.toggle('is-spotlight', entry.isIntersecting);
        }
      }, {
        rootMargin: '-24% 0px -24% 0px',
        threshold: 0.35
      });

      for (const item of items) spotObserver.observe(item);
    } catch (err) {
      console.warn('[site-anim:spotlight]', err);
    }
  }

  /* ------------------------------------------------------------------------
     5. Анимация счётчиков статистики ([data-count], #hero-views)
     ------------------------------------------------------------------------ */
  function parseCounterSpec(el) {
    const raw = (el.dataset.count && el.dataset.count !== 'auto'
      ? el.dataset.count
      : el.textContent || ''
    ).trim();

    const match = raw.match(/^([^\d-]*?)([\d\s.,]+)(.*)$/);
    if (!match) return null;

    const [, prefix, numPart, suffix] = match;
    const cleanNum = numPart.replace(/\s+/g, '');
    const hasComma = cleanNum.includes(',');
    const normalized = cleanNum.replace(',', '.');
    const target = Number.parseFloat(normalized);

    if (!Number.isFinite(target) || target <= 0) return null;

    const decMatch = normalized.split('.')[1];
    const decimals = decMatch ? decMatch.length : 0;
    const useSpaceGroups = /\d\s+\d/.test(numPart);

    return { prefix, target, decimals, hasComma, useSpaceGroups, suffix };
  }

  function formatCounterValue(val, spec) {
    let fixed = val.toFixed(spec.decimals);
    if (spec.useSpaceGroups) {
      const [intPart, fracPart] = fixed.split('.');
      const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      fixed = fracPart ? `${grouped}.${fracPart}` : grouped;
    }
    if (spec.hasComma) fixed = fixed.replace('.', ',');
    return `${spec.prefix}${fixed}${spec.suffix}`;
  }

  function animateCounter(el, spec) {
    if (el.dataset.countDone === '1') return;
    el.dataset.countDone = '1';

    if (currentMode === 'off' || typeof requestAnimationFrame !== 'function') {
      el.textContent = formatCounterValue(spec.target, spec);
      return;
    }

    const duration = 1100;
    const start = performance.now();

    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = spec.target * eased;
      el.textContent = formatCounterValue(current, spec);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatCounterValue(spec.target, spec);
      }
    }

    requestAnimationFrame(step);
  }

  function initCounters() {
    try {
      const heroViews = document.getElementById('hero-views');
      if (heroViews && !heroViews.hasAttribute('data-count')) {
        heroViews.setAttribute('data-count', 'auto');
      }

      const counters = Array.from(document.querySelectorAll('[data-count]'));
      if (!counters.length) return;

      const watchCounter = el => {
        const triggerWhenVisible = spec => {
          if (!('IntersectionObserver' in window)) {
            animateCounter(el, spec);
            return;
          }
          const io = new IntersectionObserver(entries => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                animateCounter(el, spec);
                io.disconnect();
              }
            }
          }, { threshold: 0.25 });
          io.observe(el);
        };

        const initialSpec = parseCounterSpec(el);
        if (initialSpec) {
          triggerWhenVisible(initialSpec);
          return;
        }

        // Ждём динамической подстановки числа (например, #hero-views из shorts.js)
        const mo = new MutationObserver(() => {
          const lateSpec = parseCounterSpec(el);
          if (lateSpec) {
            mo.disconnect();
            triggerWhenVisible(lateSpec);
          }
        });
        mo.observe(el, { childList: true, characterData: true, subtree: true });
        setTimeout(() => mo.disconnect(), 10000);
      };

      counters.forEach(watchCounter);
    } catch (err) {
      console.warn('[site-anim:counters]', err);
    }
  }

  /* ------------------------------------------------------------------------
     6. Вспышка клубничек и нот (Web Animations API) + пасхалка в логотипе
     ------------------------------------------------------------------------ */
  function burst(origin, opts = {}) {
    try {
      if (currentMode !== 'full') return;
      const el = origin instanceof Element ? origin : null;
      if (!el || typeof el.animate !== 'function') return;

      const rect = el.getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const icons = opts.icons || ['🍓', '♫', '✦', '✨'];
      const count = Math.min(opts.count || 5, 8);

      for (let i = 0; i < count; i++) {
        const spark = document.createElement('span');
        spark.textContent = icons[i % icons.length];
        spark.setAttribute('aria-hidden', 'true');
        Object.assign(spark.style, {
          position: 'fixed',
          left: `${cx}px`,
          top: `${cy}px`,
          zIndex: '90',
          pointerEvents: 'none',
          userSelect: 'none',
          fontSize: `${14 + (i % 3) * 2}px`,
          lineHeight: '1',
          color: 'var(--gold, #e5b869)',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.45)'
        });

        document.body.append(spark);

        const angle = (-Math.PI * 0.85) + (i / Math.max(count - 1, 1)) * (Math.PI * 0.7) + (Math.random() * 0.25 - 0.12);
        const dist = 36 + Math.random() * 34;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 10;
        const rot = (Math.random() * 44 - 22).toFixed(0);

        const anim = spark.animate(
          [
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.45)' },
            { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.35}px)) scale(1.05)`, offset: 0.25 },
            { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.95) rotate(${rot}deg)` }
          ],
          {
            duration: 720,
            easing: 'cubic-bezier(.16, 1, .3, 1)',
            fill: 'forwards'
          }
        );

        anim.onfinish = () => spark.remove();
      }
    } catch {
      /* декоративный эффект не должен ломать интерфейс */
    }
  }

  function initBrandEasterEgg() {
    try {
      const bind = () => {
        const berry = document.querySelector('.brand .berry');
        if (!berry || berry.dataset.berryBound === '1') return;
        berry.dataset.berryBound = '1';
        berry.addEventListener('pointerdown', () => {
          burst(berry, { icons: ['🍓', '♫', '✨', '🍓'], count: 5 });
        }, { passive: true });
      };

      bind();
      if (!document.querySelector('.brand .berry')) {
        setTimeout(bind, 400);
      }
    } catch (err) {
      console.warn('[site-anim:berry]', err);
    }
  }

  /* ------------------------------------------------------------------------
     7. Универсальный контроллер маскотов ([data-mascot])
     В кадре одновременно «дышит» не больше одного персонажа
     ------------------------------------------------------------------------ */
  function initMascots() {
    try {
      const mascots = Array.from(document.querySelectorAll('[data-mascot]'));
      if (!mascots.length) return;

      const visibleSet = new Set();

      const syncActiveBreathing = () => {
        let assigned = false;
        for (const m of mascots) {
          if (!assigned && visibleSet.has(m) && currentMode === 'full') {
            m.classList.add('is-breathing');
            assigned = true;
          } else {
            m.classList.remove('is-breathing');
          }
        }
      };

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
          for (const entry of entries) {
            const el = entry.target;
            if (entry.isIntersecting) {
              el.classList.add('is-in');
              visibleSet.add(el);
            } else {
              visibleSet.delete(el);
            }
          }
          syncActiveBreathing();
        }, { threshold: 0.2 });

        for (const m of mascots) io.observe(m);
      } else {
        mascots.forEach(m => m.classList.add('is-in'));
      }

      for (const m of mascots) {
        const linesRaw = m.dataset.lines || '';
        const lines = linesRaw.split('|').map(s => s.trim()).filter(Boolean);
        let lineIdx = 0;

        m.addEventListener('click', () => {
          if (currentMode === 'off') return;

          m.classList.remove('is-excited');
          void m.offsetWidth;
          m.classList.add('is-excited');
          burst(m, { icons: ['✦', '♫', '🍓', '✨'], count: 4 });

          if (lines.length) {
            const bubbleSel = m.dataset.mascotBubble;
            const bubble = bubbleSel
              ? document.querySelector(bubbleSel)
              : m.parentElement?.querySelector('[data-mascot-bubble]');

            if (bubble) {
              lineIdx = (lineIdx + 1) % lines.length;
              bubble.textContent = lines[lineIdx];
              bubble.classList.add('is-mobile-open');
              clearTimeout(bubble._hideTimer);
              bubble._hideTimer = setTimeout(() => {
                bubble.classList.remove('is-mobile-open');
              }, 3800);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[site-anim:mascots]', err);
      document.querySelectorAll('[data-mascot]').forEach(m => m.classList.add('is-in'));
    }
  }

  /* ------------------------------------------------------------------------
     Запуск после готовности DOM
     ------------------------------------------------------------------------ */
  function boot() {
    initFooterSetting();
    initThemeWave();
    initScrollReveal();
    initMobileSpotlight();
    initCounters();
    initBrandEasterEgg();
    initMascots();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ClubnikaAnim = {
    getMode: () => currentMode,
    setMode,
    switchTheme: runThemeWave,
    burst,
    refresh: () => {
      initScrollReveal();
      initMobileSpotlight();
      initCounters();
      initMascots();
    }
  };
})();
```[cite: 2]