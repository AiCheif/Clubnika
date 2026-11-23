// Albums are displayed from newest to oldest, regardless of their order here.
// date: YYYY-MM-DD; cover: optional path to a cover image; items: media records.
window.SIGN_ALBUMS = [
  {
    date: '2026-11-20',
    items: window.SIGN_ITEMS || [],
    cover: (window.SIGN_ITEMS || []).find(item => item.type === 'photo')?.poster
  }
];
