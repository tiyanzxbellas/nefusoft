// Integration smoke test untuk alur halaman Watch (slug episode baru "-sub-indo").
// Jalankan: npx vite-node scripts/test-watch-flow.mjs
import { strict as assert } from 'node:assert';
import { JSDOM } from 'jsdom';

// ---------- jsdom environment ----------
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { globalThis.navigator = dom.window.navigator; } catch { Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); }
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.File = dom.window.File;
globalThis.Blob = dom.window.Blob;
globalThis.scrollTo = () => {};
dom.window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ---------- Fixture real-shape (diambil dari API asli 10 Agu 2026) ----------
const ANIME_ID = 'hyakkano-s3-sub-ind';
const EP = (n) => `hykno-s3-episode-${n}-sub-indo`;

const mkEpisodeList = () =>
  [6, 5, 4, 3, 2, 1].map((n) => ({ // API list TERBALIK — terbaru dulu
    title: `Hyakkano Season 3 Episode ${n} Subtitle Indonesia`,
    eps: n,
    date: `${10 - n} Agustus,2026`,
    episodeId: EP(n),
  }));

const animeDetailRes = {
  ok: true,
  data: {
    title: 'Hyakkano Season 3',
    poster: 'https://otakudesu.blog/poster.jpg',
    type: 'TV',
    status: 'Ongoing',
    episodes: null,
    aired: 'Jul 05, 2026',
    studios: 'Bibury Animation s',
    synopsis: { paragraphs: ['Sinopsis dummy.'], connections: [] },
    genreList: [{ title: 'Comedy', genreId: 'comedy' }],
    episodeList: mkEpisodeList(),
  },
};

const mkEpisodeRes = (n) => ({
  ok: true,
  data: {
    title: `Hyakkano Season 3 Episode ${n} Subtitle Indonesia`,
    animeId: ANIME_ID, // ← kunci resolve slug anime
    defaultStreamingUrl: `https://www.blogger.com/video.g?token=TOKEN-EP${n}`,
    prevEpisode: n > 1 ? { episodeId: EP(n - 1) } : null,
    nextEpisode: n < 6 ? { episodeId: EP(n + 1) } : null,
    server: {
      qualities: [
        { title: '720p', serverList: [{ title: 'vidhide', serverId: 'SRV-1-2X' }] },
      ],
    },
    downloadUrl: { qualities: [] },
  },
});

const serverRes = { ok: true, data: { url: 'https://odvidhide.com/embed/xyz' } };
const popularRes = { ok: true, data: { animeList: [{ title: 'One Piece', poster: 'p', animeId: '1piece-sub-indo' }] } };

// ---------- Mock fetch: decode CORS-proxy URL lalu route ----------
const API = 'https://www.sankavollerei.web.id/anime';
const fetches = [];
globalThis.fetch = async (rawUrl) => {
  const url = String(rawUrl);
  fetches.push(url);
  const unwrap = url.includes('url=') ? decodeURIComponent(new URL(url).searchParams.get('url') || '') : url;
  const json = (obj) => ({ ok: true, status: 200, json: async () => obj });

  if (url.includes('api.jikan.moe')) return json({ data: [] });
  const path = unwrap.replace(API, '');
  if (path.startsWith('/episode/')) {
    const m = path.match(/-episode-(\d+)-/);
    return json(mkEpisodeRes(parseInt(m[1], 10)));
  }
  if (path.startsWith('/anime/')) return unwrap.endsWith(ANIME_ID) ? json(animeDetailRes) : json({ ok: false, data: null });
  if (path.startsWith('/server/')) return json(serverRes);
  if (path.startsWith('/complete-anime')) return json(popularRes);
  if (path.startsWith('/ongoing-anime')) return json({ ok: true, data: { animeList: [] } });
  throw new Error('URL tak dikenal di mock: ' + unwrap);
};

// ---------- Render app ----------
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const { default: Watch } = await import('../src/pages/Watch.jsx');

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 50)); }); };

const run = async (initialPath, label) => {
  document.getElementById('root').innerHTML = '';
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(
      React.createElement(MemoryRouter, { initialEntries: [initialPath] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: '/anime/:slug/:episode?', element: React.createElement(Watch) }),
          React.createElement(Route, { path: '*', element: React.createElement(Watch) }),
        ))
    );
  });
  await flush(); await flush(); await flush();

  const html = document.body.textContent || '';
  const iframe = document.querySelector('iframe');
  const epButtons = [...document.querySelectorAll('button')].filter((b) => /^\d+$/.test(b.textContent.trim()));

  console.log(`\n=== ${label} ===`);
  console.log('judul dokumen   :', document.title);
  console.log('iframe src      :', iframe?.src || '(tidak ada iframe!)');
  console.log('tombol episode  :', epButtons.slice(0, 12).map((b) => b.textContent.trim()).join(' '));

  assert.ok(!html.includes('video tidak tersedia'), `❌ ${label}: "video tidak tersedia" masih muncul`);
  assert.ok(iframe, `❌ ${label}: iframe player tidak ada`);
  assert.ok(epButtons.length >= 6, `❌ ${label}: daftar episode kosong (${epButtons.length} tombol)`);
  const asc = epButtons.every((b, i, a) => i === 0 || parseInt(a[i - 1].textContent) <= parseInt(b.textContent));
  assert.ok(asc, `❌ ${label}: grid episode tidak urut ascending`);
  const title = document.title; // simpan sebelum unmount (cleanup mereset judul)
  assert.ok(title.includes('Hyakkano'), `❌ ${label}: judul dokumen = "${title}"`);
  act(() => root.unmount());
  return { iframe, epButtons, html };
};

// TEST 1: langsung buka URL episode baru (-episode-6-sub-indo)
const t1 = await run(`/anime/${EP(6)}`, 'test 1 — buka langsung URL episode baru');
assert.ok(t1.iframe.src.includes('TOKEN-EP6'), 'harus memutar episode 6 (default streaming url)');

// TEST 2: buka halaman anime murni → redirect episode 1 → video muncul
const t2 = await run(`/anime/${ANIME_ID}`, 'test 2 — halaman anime → auto ke episode 1');
assert.ok(t2.iframe.src.includes('TOKEN-EP1'), 'harus memutar episode 1 setelah redirect');

// TEST 3: URL gaya History /anime/:id/3 → lanjut episode 3
const t3 = await run(`/anime/${ANIME_ID}/3`, 'test 3 — link History ke episode 3');
assert.ok(t3.iframe.src.includes('TOKEN-EP3'), 'harus memutar episode 3 dari link History');

console.log('\n✅ SEMUA TEST WATCH FLOW PASS');
process.exit(0); // paksa keluar — timer supabase/jsdom menahan event loop

// Watchdog: matikan proses kalau ada yang hang
setTimeout(() => { console.error('❌ WATCHDOG TIMEOUT'); process.exit(2); }, 120_000);
