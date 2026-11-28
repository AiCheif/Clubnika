(() => {
  const SOCIAL_STATS_URL = './remixes/release-social.json';

  const goals = [
    { views: 10000, name: 'Клубничный старт', icon: '🍓' },
    { views: 25000, name: 'Набираем обороты', icon: '✨' },
    { views: 50000, name: 'Бронзовая клубничка', icon: '🥉' },
    { views: 100000, name: 'Серебряная клубничка', icon: '🥈' },
    { views: 250000, name: 'Золотая клубничка', icon: '🥇' },
    { views: 500000, name: 'Клубничный рекорд', icon: '🏆' }
  ];

  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const board = $('release-achievements');
  if (!board) return;

  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const count = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;

  function plural(n, one, few, many) {
    const mod100 = Math.abs(n) % 100;
    const mod10 = mod100 % 10;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function formatUpdated(raw) {
    if (!raw) return '';
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) return '';
    const hasTime = typeof raw === 'string' && /[T ]\d{2}:\d{2}/.test(raw);
    const formatted = new Intl.DateTimeFormat(
      'ru-RU',
      hasTime
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }
        : { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }
    ).format(new Date(ts));
    return hasTime ? `${formatted} МСК` : formatted;
  }

  let previousViews = null, demoViews = 0, demoVideos = 0;

  const steps = goals.map(goal => {
    const node = document.createElement('div');
    node.className = 'achievement-step';
    const medal = document.createElement('span');
    medal.className = 'achievement-medal';
    medal.textContent = goal.icon;
    const value = document.createElement('strong');
    value.textContent = fmt(goal.views);
    const name = document.createElement('small');
    name.textContent = goal.name;
    const status = document.createElement('span');
    status.className = 'achievement-step-status';
    node.append(medal, value, name, status);
    $('achievement-milestones').append(node);
    return { node, status, goal };
  });

  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sparks = $('achievement-sparks');
    sparks.replaceChildren();
    for (let i = 0; i < 20; i++) {
      const e = document.createElement('i');
      e.textContent = i % 3 === 0 ? '✦' : '✧';
      const angle = i * 2 * Math.PI / 20;
      const radius = 100 + (i % 4) * 45;
      e.style.setProperty('--dx', Math.cos(angle) * radius + 'px');
      e.style.setProperty('--dy', Math.sin(angle) * radius + 'px');
      e.style.setProperty('--delay', (i % 4) * 0.05 + 's');
      sparks.append(e);
    }
    setTimeout(() => sparks.replaceChildren(), 1300);
  }

  function render(views, videos, animate = false) {
    views = count(views);
    videos = count(videos);
    const current = goals.find(g => views < g.views);
    const last = [...goals].reverse().find(g => views >= g.views);
    const target = current || goals[goals.length - 1];
    const percent = Math.min(100, views / target.views * 100);

    $('achievement-views').textContent = fmt(views);
    $('achievement-videos').textContent = fmt(videos);
    $('achievement-goal').textContent = current ? 'Следующая цель: ' + fmt(target.views) : 'Клубничный рекорд достигнут!';
    $('achievement-percent').textContent = Math.floor(percent) + '%';
    $('achievement-fill').style.width = percent + '%';

    const bar = $('achievement-progress');
    bar.setAttribute('aria-valuemax', String(target.views));
    bar.setAttribute('aria-valuenow', String(Math.min(views, target.views)));
    bar.setAttribute('aria-valuetext', fmt(views) + ' из ' + fmt(target.views) + ' просмотров');

    $('achievement-caption').textContent = current
      ? fmt(views) + ' / ' + fmt(target.views) + ' · осталось ' + fmt(target.views - views)
      : fmt(views) + ' просмотров · все цели пройдены!';

    for (const { node, status, goal } of steps) {
      const earned = views >= goal.views;
      const isCurrent = goal === current;
      node.classList.toggle('earned', earned);
      node.classList.toggle('current', isCurrent);
      status.textContent = earned ? '✓ Достигнуто' : isCurrent ? 'Текущая цель' : '🔒 Впереди';
    }

    const crossed = previousViews !== null && goals.some(g => previousViews < g.views && views >= g.views);
    previousViews = views;
    $('achievement-message').textContent = last
      ? (current
          ? 'Ура! Вместе мы набрали ' + fmt(last.views) + ' просмотров!'
          : 'Ура! Мы достигли клубничного рекорда — ' + fmt(last.views) + ' просмотров!')
      : 'Каждый ролик приближает нас к первой цели. Создадим её вместе!';
    if (animate && crossed) celebrate();
  }

  function renderPlatforms(items) {
    const container = $('achievement-platforms');
    if (!container) return;
    container.replaceChildren();

    if (!items.length) {
      container.hidden = true;
      return;
    }

    for (const item of items) {
      const views = count(item.views);
      const videos = count(item.videos);

      const card = document.createElement('div');
      card.className = 'achievement-platform';

      const name = document.createElement('span');
      name.className = 'achievement-platform-name';
      name.textContent = item.label;

      const viewsNode = document.createElement('div');
      viewsNode.className = 'achievement-platform-views';
      const viewsNum = document.createElement('strong');
      viewsNum.textContent = fmt(views);
      const viewsLabel = document.createElement('span');
      viewsLabel.textContent = plural(views, 'просмотр', 'просмотра', 'просмотров');
      viewsNode.append(viewsNum, viewsLabel);

      const meta = document.createElement('span');
      meta.className = 'achievement-platform-meta';
      meta.textContent = `${fmt(videos)} ${plural(videos, 'ролик', 'ролика', 'роликов')}`;

      card.append(name, viewsNode, meta);

      const updatedText = formatUpdated(item.updatedAt);
      if (updatedText) {
        const updated = document.createElement('span');
        updated.className = 'achievement-platform-updated';
        updated.textContent = `Обновлено: ${updatedText}`;
        card.append(updated);
      }

      container.append(card);
    }

    container.hidden = false;
  }

  function syncDemo() {
    const slider = $('achievement-slider');
    const views = $('achievement-demo-views');
    const videos = $('achievement-demo-videos');
    slider.value = String(Math.min(500000, demoViews));
    views.value = String(demoViews);
    videos.value = String(demoVideos);
    render(demoViews, demoVideos, true);
  }

  if (demo) {
    $('achievement-demo').hidden = false;
    $('achievement-source').textContent = 'Тестовый режим — значения не сохраняются и не влияют на реальную статистику.';
    const slider = $('achievement-slider');
    const views = $('achievement-demo-views');
    const videos = $('achievement-demo-videos');
    slider.addEventListener('input', () => { demoViews = count(Number(slider.value)); syncDemo(); });
    views.addEventListener('change', () => { demoViews = count(Number(views.value)); syncDemo(); });
    videos.addEventListener('change', () => { demoVideos = count(Number(videos.value)); syncDemo(); });
    $('achievement-next').addEventListener('click', () => {
      demoViews = (goals.find(g => g.views > demoViews) || goals[goals.length - 1]).views;
      syncDemo();
    });
    $('achievement-reset').addEventListener('click', () => { demoViews = 0; demoVideos = 0; syncDemo(); });
    syncDemo();
    return;
  }

  function formatPlatformList(names) {
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1];
  }

  async function fetchYouTube() {
    try {
      const registryRes = await fetch('./remixes/projects.json', { cache: 'no-cache' });
      if (!registryRes.ok) return null;
      const registry = await registryRes.json();
      const project = registry.projects?.find(p => p.id === registry.releaseProject);
      if (!project?.ranking) return null;

      const res = await fetch(`./${project.ranking}`, { cache: 'no-cache' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.stats || !Number.isFinite(data.stats.views) || !Number.isFinite(data.stats.videoCount)) return null;

      const views = count(data.stats.views);
      const videos = count(data.stats.videoCount);

      return {
        views,
        videos,
        names: ['YouTube'],
        breakdown: [{ label: '▶ YouTube Shorts', views, videos, updatedAt: data.updatedAt || null }]
      };
    } catch {
      return null;
    }
  }

  async function fetchSocial() {
    try {
      const res = await fetch(SOCIAL_STATS_URL, { cache: 'no-cache' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.stats || !Number.isFinite(data.stats.views) || !Number.isFinite(data.stats.videoCount)) return null;

      const names = [];
      const breakdown = [];

      if (data.platforms?.tiktok) {
        names.push('TikTok');
        breakdown.push({
          label: '♫ TikTok',
          views: count(data.platforms.tiktok.views),
          videos: count(data.platforms.tiktok.videoCount),
          updatedAt: data.platforms.tiktok.updatedAt || data.updatedAt || null
        });
      }
      if (data.platforms?.instagram) {
        names.push('Instagram');
        breakdown.push({
          label: '◎ Instagram Reels',
          views: count(data.platforms.instagram.views),
          videos: count(data.platforms.instagram.videoCount),
          updatedAt: data.platforms.instagram.updatedAt || data.updatedAt || null
        });
      }
      if (!names.length) names.push('TikTok', 'Instagram');

      return {
        views: count(data.stats.views),
        videos: count(data.stats.videoCount),
        names,
        breakdown
      };
    } catch {
      return null;
    }
  }

  async function load() {
    const [yt, social] = await Promise.all([fetchYouTube(), fetchSocial()]);
    const sources = [yt, social].filter(Boolean);

    if (!sources.length) {
      $('achievement-source').textContent = 'Не удалось загрузить статистику. Попробуйте обновить страницу.';
      return;
    }

    const totalViews = sources.reduce((sum, s) => sum + s.views, 0);
    const totalVideos = sources.reduce((sum, s) => sum + s.videos, 0);
    const names = sources.flatMap(s => s.names);
    const breakdown = sources.flatMap(s => s.breakdown);

    const latestEntry = breakdown
      .map(b => ({ raw: b.updatedAt, ts: Date.parse(b.updatedAt) }))
      .filter(x => Number.isFinite(x.ts))
      .sort((a, b) => b.ts - a.ts)[0];

    render(totalViews, totalVideos);
    renderPlatforms(breakdown);

    const label = formatPlatformList(names);
    const latestText = formatUpdated(latestEntry?.raw);
    $('achievement-source').textContent = latestText
      ? `Статистика ${label} · последнее обновление: ${latestText}`
      : `Данные ${label} появятся после публикации первых роликов.`;
  }

  load();
})();