/**
 * NefuSoft API Adapter (Sanka Vollerei v2)
 * ----------------------------------------------------------------
 * Project ini sebelumnya menggunakan endpoint lama:
 *   https://www.sankavollerei.com/anime/stream/*
 *
 * Sanka Vollerei sudah migrasi ke domain baru dengan struktur
 * endpoint yang BERUBAH TOTAL:
 *   https://www.sankavollerei.web.id/anime/*
 *
 * File ini jadi SINGLE SOURCE OF TRUTH untuk semua request ke API.
 * Setiap halaman tinggal panggil helper di sini, dapat data yang
 * sudah dinormalisasi ke shape lama (image_poster, image_cover,
 * episodes[], stream_links[], dll) supaya UI tidak perlu diubah.
 *
 * CORS PROXY
 * ----------------------------------------------------------------
 * Server API Sanka Vollerei TIDAK mengirim header CORS, jadi request
 * langsung dari browser (fetch ke origin lain) selalu diblokir.
 * Semua request di file ini dirutekan lewat CORS proxy chain:
 *   1. Worker Cloudflare milik project (sama seperti halaman Donghua)
 *   2. Fallback public proxies (corsproxy.io, allorigins, codetabs)
 *   3. Direct fetch (fallback terakhir)
 * Proxy utama bisa dioverride via env `VITE_CORS_PROXY`
 * (set ke "direct" untuk menonaktifkan proxy sepenuhnya).
 *
 * Shape response API baru (contoh untuk /anime/ongoing-anime):
 *   { status, creator, data: { animeList: [
 *       { title, poster, animeId, releaseDay, latestReleaseDate, ... }
 *     ] } }
 *
 * Helper functions di file ini:
 *   - fetchSchedule()      → /anime/schedule (untuk Home + Schedule)
 *   - fetchOngoing(page)   → /anime/ongoing-anime
 *   - fetchPopular(page)   → fallback ke ongoing kalau endpoint "popular" tidak ada
 *   - fetchAnime(slug)     → /anime/anime/:slug
 *   - fetchEpisode(slug)   → /anime/episode/:slug
 *   - fetchServer(serverId)→ /anime/server/:serverId
 *   - fetchSearch(q)       → /anime/search/:q
 *   - fetchGenres()        → /anime/genre
 *   - fetchGenre(slug,p)   → /anime/genre/:slug?page=:p
 *   - fetchComplete(page)  → /anime/complete-anime?page=:p
 *   - fetchHome()          → /anime/home
 *
 * Semua helper di atas menerima optional `signal` (AbortSignal) supaya
 * React bisa cancel request saat komponen unmount.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://www.sankavollerei.web.id/anime';

// Cloudflare Worker yang dipakai untuk proxy gambar & mp4 (handle referer/CORS)
const IMG_PROXY = 'https://cf.tiyanstores.workers.dev/?url=';
const MP4_PROXY_BASE = 'https://cf.elainaa.workers.dev/';

export const getImgProxy = (url) => (url ? `${IMG_PROXY}${encodeURIComponent(url)}` : '');
export const getMp4Proxy = (url) => (url ? `${MP4_PROXY_BASE}${url}` : '');

// =====================
// CORS Proxy chain
// =====================
// API anime tidak punya header CORS → browser menolak response-nya.
// Karena itu semua request API dirutekan lewat sederetan proxy.
// Proxy #1 adalah Cloudflare Worker milik project (worker yang sama juga
// dipakai halaman Donghua/Manga). Sisanya public fallback kalau worker down.
// Override proxy utama lewat env VITE_CORS_PROXY (isi "direct" untuk bypass).
const CORS_PROXY_ENV = import.meta.env.VITE_CORS_PROXY;
const CORS_PROXIES =
  CORS_PROXY_ENV === 'direct'
    ? []
    : [
        CORS_PROXY_ENV || 'https://cf.tiyanstores.workers.dev/?url=',
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
      ];

// URL API lewat CORS proxy utama (dipakai juga kalau modul lain butuh manual)
export const getApiUrl = (url) =>
  CORS_PROXIES.length ? `${CORS_PROXIES[0]}${encodeURIComponent(url)}` : url;

// fetch dengan timeout supaya proxy yang hang cepat diloncati
const fetchWithTimeout = async (url, { signal, timeoutMs = 12000 } = {}) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
};

// =====================
// Response cache (GET-like)
// =====================
// Navigasi berulang (mis. ganti episode, balik ke Home, buka lagi halaman yang
// sama) tidak perlu nunggu round-trip proxy setiap kali. Data dinormalisasi
// lalu di-cache singkat di memori (TTL 5 menit). Cukup kecil & cepat, aman
// untuk data list/detail yang jarang berubah per-menit.
const RESPONSE_TTL_MS = 5 * 60 * 1000; // 5 menit
const responseCache = new Map();

const getCachedResponse = (key) => {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at < RESPONSE_TTL_MS) return hit.data;
  responseCache.delete(key);
  return null;
};

const setCachedResponse = (key, data) => {
  try {
    responseCache.set(key, { at: Date.now(), data });
    // Jaga ukuran cache tetap wajar (FIFO sederhana)
    if (responseCache.size > 300) {
      const oldest = responseCache.keys().next().value;
      if (oldest) responseCache.delete(oldest);
    }
  } catch (e) {}
};

// Bersihkan cache (dipanggil kalau UI butuh data segar).
export const clearApiCache = () => responseCache.clear();

// Helper low-level fetch dengan error handling yang konsisten.
//
// SEMUA CORS proxy (termasuk direct fetch) dicoba SECARA PARALEL dan response
// sukses pertama yang menang (Promise.any). Ini menghindari masalah utama lama:
// request berjalan SEKUENSIAL (proxy#1 timeout 15s → proxy#2 timeout 15s → …)
// yang bikin halaman nunggu puluhan detik saat proxy utama lambat/down.
const request = async (path, { signal, skipCache = false } = {}) => {
  const target = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const cacheKey = target;

  if (!skipCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');

  const urls = [...CORS_PROXIES.map((p) => `${p}${encodeURIComponent(target)}`), target];

  const attempt = async (url) => {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    const res = await fetchWithTimeout(url, { signal });
    if (!res.ok) throw new Error(`API ${res.status} ${res.statusText} (${url})`);
    return await res.json();
  };

  let lastErr = null;
  const attempts = urls.map((url) =>
    attempt(url).catch((err) => {
      lastErr = err;
      return Promise.reject(err);
    })
  );

  try {
    const data = await Promise.any(attempts);
    if (!skipCache) setCachedResponse(cacheKey, data);
    return data;
  } catch (aggErr) {
    // Abort oleh caller (unmount/route change) → lempar alasan aslinya
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    throw lastErr ?? new Error(`Gagal fetch ${target}`);
  }
};

// =====================
// Normalizer helpers
// =====================

// Episode list: API baru → shape lama { id, slug, eps_title, eps_slug, ... }
const normalizeEpisode = (ep) => ({
  id: ep.episodeId || ep.slug || ep.id,
  slug: ep.episodeId || ep.slug || ep.id,
  eps_title: ep.title,
  eps_slug: ep.episodeId || ep.slug || ep.id,
  eps: ep.eps,
  date: ep.date,
});

// Anime umum (ongoing / complete / search / genre) → shape lama { id, title, image_poster, image_cover, ... }
const normalizeAnime = (a) => {
  if (!a) return null;
  const slug = a.animeId || a.slug || a.id;
  return {
    ...a,
    id: slug,
    slug,
    image_poster: a.poster,
    image_cover: a.poster, // API baru cuma punya 1 field poster, jadi pakai untuk keduanya
    status: (a.status || '').toString().toUpperCase() === 'ONGOING' ? 'Ongoing' : (a.status || 'Completed'),
  };
};

// Schedule item (per hari): API baru { day, anime_list: [{title, slug, poster, ...}] }
const normalizeScheduleDay = (dayEntry) => ({
  day: dayEntry.day,
  anime_list: (dayEntry.anime_list || []).map((a) => ({
    id: a.slug || a.animeId,
    title: a.title,
    image_poster: a.poster,
    image_cover: a.poster,
    slug: a.slug || a.animeId,
  })),
});

// Anime detail → field yang dipakai UI (poster, title, synopsis, episodes, studio, year, ...)
const normalizeAnimeDetail = (d) => {
  if (!d) return null;
  return {
    ...d,
    id: d.animeId || d.id || d.slug,
    slug: d.animeId || d.slug || d.id,
    image_poster: d.poster,
    image_cover: d.poster,
    image_hero: d.poster,
    poster: d.poster,
    synopsis:
      d.synopsis?.paragraphs?.join('\n\n') ||
      (Array.isArray(d.synopsis) ? d.synopsis.join('\n\n') : d.synopsis) ||
      '',
    episodes: (d.episodeList || d.episodes || []).map(normalizeEpisode),
    episode_list: (d.episodeList || d.episodes || []).map(normalizeEpisode),
    genres: (d.genreList || []).map((g) => g.title),
    genre: (d.genreList || []).map((g) => g.title).join(', '),
    studio: d.studios,
    status: d.status,
    type: d.type,
    year: d.aired ? String(parseInt(d.aired, 10) || '') : null,
    aired_start: d.aired,
  };
};

// Episode detail (URL stream + download) → shape lama yang dipakai Watch.jsx
//   { stream_links: [{ server, url, quality }], download_links: [{ server, url }], next_slug, prev_slug }
const normalizeEpisodeDetail = (ep) => {
  if (!ep) return null;

  // Flatten qualities → array stream_links
  const stream_links = [];
  (ep.server?.qualities || []).forEach((q) => {
    (q.serverList || []).forEach((s) => {
      stream_links.push({
        server: `${q.title || ''} ${s.title || ''}`.trim() || s.title || 'Server',
        url: s.url || '', // serverId perlu di-resolve via /anime/server/:serverId
        serverId: s.serverId,
        quality: q.title,
        type: 'stream',
      });
    });
  });

  // Kalau ada defaultStreamingUrl (Blogger embed), tambahkan sebagai default
  if (ep.defaultStreamingUrl) {
    stream_links.unshift({
      server: 'Default',
      url: ep.defaultStreamingUrl,
      quality: 'auto',
      type: 'stream',
    });
  }

  // Flatten download
  const download_links = [];
  (ep.downloadUrl?.qualities || []).forEach((q) => {
    (q.urls || []).forEach((u) => {
      download_links.push({
        server: `${q.title || ''} ${u.title || ''}`.trim() || u.title || 'Download',
        url: u.url,
        quality: q.title,
        size: q.size,
        type: 'download',
      });
    });
  });

  return {
    title: ep.title,
    animeId: ep.animeId,
    next_slug: ep.nextEpisode?.episodeId || null,
    prev_slug: ep.prevEpisode?.episodeId || null,
    stream_links,
    download_links,
    // Metadata tambahan (untuk history dll)
    releaseTime: ep.releaseTime,
  };
};

// Genres list: API baru { data: { genreList: [{title, genreId, ...}] } }
const normalizeGenres = (data) =>
  (data?.genreList || []).map((g) => ({
    id: g.genreId,
    name: g.title,
    slug: g.genreId,
  }));

// =====================
// Public API helpers
// =====================

export const fetchSchedule = async ({ signal } = {}) => {
  const res = await request('/schedule', { signal });
  const days = (res?.data || []).map(normalizeScheduleDay);
  // Convert array of days → object { MINGGU: [...], SENIN: [...] } (shape lama Home.jsx)
  const scheduleByDay = {};
  days.forEach((d) => {
    // Map hari Indonesia → key uppercase yang dipakai UI ("MINGGU","SENIN",...)
    const key = (d.day || '').toString().toUpperCase();
    scheduleByDay[key] = (d.anime_list || []).map((a) => ({
      ...a,
      // Schedule tidak punya detail studio/genre secara default;
      // ScheduleCard akan lazy fetch detail kalau perlu
      status: 'ONGOING', // Schedule selalu anime ongoing
    }));
  });
  return scheduleByDay;
};

export const fetchOngoing = async (page = 1, { signal } = {}) => {
  const res = await request(`/ongoing-anime?page=${page}`, { signal });
  return (res?.data?.animeList || []).map(normalizeAnime);
};

// API baru tidak punya endpoint "popular" spesifik. Pakai ongoing sebagai fallback
// (sebelumnya API lama juga pakai ongoing untuk "Top 10").
export const fetchPopular = async (_page = 1, opts) => {
  try {
    // Coba complete-anime dulu (biasanya lebih "stabil" untuk "top/popular")
    const res = await request('/complete-anime?page=1', opts);
    return (res?.data?.animeList || []).map(normalizeAnime);
  } catch (e) {
    // Fallback ke ongoing
    return fetchOngoing(1, opts);
  }
};

export const fetchHome = async (opts) => {
  // /anime/home berisi { ongoing: { animeList }, completed: { animeList } }
  const res = await request('/home', opts);
  return {
    ongoing: (res?.data?.ongoing?.animeList || []).map(normalizeAnime),
    completed: (res?.data?.completed?.animeList || []).map(normalizeAnime),
  };
};

export const fetchComplete = async (page = 1, opts) => {
  const res = await request(`/complete-anime?page=${page}`, opts);
  return (res?.data?.animeList || []).map(normalizeAnime);
};

export const fetchAnime = async (slug, opts) => {
  const res = await request(`/anime/${encodeURIComponent(slug)}`, opts);
  return normalizeAnimeDetail(res?.data);
};

export const fetchEpisode = async (slug, opts) => {
  const res = await request(`/episode/${encodeURIComponent(slug)}`, opts);
  return normalizeEpisodeDetail(res?.data);
};

export const fetchServer = async (serverId, opts) => {
  const res = await request(`/server/${encodeURIComponent(serverId)}`, opts);
  return res?.data?.url || null;
};

export const fetchSearch = async (query, opts) => {
  const res = await request(`/search/${encodeURIComponent(query)}`, opts);
  return (res?.data?.animeList || []).map(normalizeAnime);
};

export const fetchGenres = async (opts) => {
  const res = await request('/genre', opts);
  return normalizeGenres(res?.data);
};

export const fetchGenre = async (slug, page = 1, opts) => {
  const res = await request(`/genre/${encodeURIComponent(slug)}?page=${page}`, opts);
  return (res?.data?.animeList || []).map(normalizeAnime);
};

// =====================
// Unified fetch wrapper
// =====================
//
// UI yang sudah ada pakai URL path langsung (misal /api/schedule, /anime/stream/...).
// Helper `apiFetch` menerjemahkan path lama ke endpoint baru secara transparan.
// Ini cara cepat migrate tanpa harus bongkar semua komponen sekaligus.
//
// Tapi cara TERBAIK adalah pakai named helper di atas langsung.
// Lihat README baru nanti: `import { fetchSchedule } from '../utils/api'`
//
// Translator ini hanya untuk backward compat cepat.

const LEGACY_MAP = {
  '/api/schedule': fetchSchedule,
  '/anime/stream/schedule': fetchSchedule,
  '/anime/stream/latest': (opts) => fetchOngoing(1, opts),
  '/anime/stream/ongoing': (opts) => fetchOngoing(1, opts),
  '/anime/stream/popular': (opts) => fetchPopular(1, opts),
  '/anime/stream/genres': (opts) => fetchGenres(opts),
};

export const apiFetch = async (path, opts) => {
  // Strip query string untuk lookup
  const cleanPath = path.split('?')[0];

  // Exact match?
  if (LEGACY_MAP[cleanPath]) {
    return { data: await LEGACY_MAP[cleanPath](opts) };
  }

  // Path dengan parameter
  let m;
  if ((m = cleanPath.match(/^\/anime\/stream\/anime\/(.+)$/))) {
    return { data: await fetchAnime(m[1], opts) };
  }
  if ((m = cleanPath.match(/^\/anime\/stream\/episode\/(.+)$/))) {
    const ep = await fetchEpisode(m[1], opts);
    // Kalau stream_links berisi serverId (belum di-resolve), resolve sekarang
    await Promise.all(
      (ep?.stream_links || []).map(async (s) => {
        if (!s.url && s.serverId) {
          try {
            const real = await fetchServer(s.serverId, opts);
            s.url = real || '';
          } catch (e) {
            s.url = '';
          }
        }
      })
    );
    return { data: ep };
  }
  if ((m = cleanPath.match(/^\/anime\/stream\/search\/(.+)$/))) {
    return { data: await fetchSearch(m[1], opts) };
  }
  if ((m = cleanPath.match(/^\/anime\/stream\/popular(\d+)?$/))) {
    return { data: await fetchPopular(parseInt(m[1] || '1', 10), opts) };
  }
  if ((m = cleanPath.match(/^\/anime\/stream\/genres\/(.+)$/))) {
    // Bisa berisi multiple genre IDs dipisah &, atau single slug + page
    const tail = m[1];
    const [slug, qs] = tail.split('&page=');
    const page = parseInt(qs || '1', 10);
    return { data: await fetchGenre(slug, page, opts) };
  }

  // Fallback: request langsung ke API_BASE (berguna untuk endpoint baru)
  const res = await request(path, opts);
  return res;
};

// Map slug → id-like yang aman untuk URL/identifier.
// UI lama generate URL seperti `/anime/{id}-{slug}`.
// Sekarang kita pakai `animeId` (yang sama dengan `slug`) sebagai id.
export const buildAnimeSlug = (anime) =>
  (anime?.animeId || anime?.slug || anime?.id || '').toString();

export default {
  fetchSchedule,
  fetchOngoing,
  fetchPopular,
  fetchHome,
  fetchComplete,
  fetchAnime,
  fetchEpisode,
  fetchServer,
  fetchSearch,
  fetchGenres,
  fetchGenre,
  apiFetch,
  getImgProxy,
  getMp4Proxy,
  getApiUrl,
  buildAnimeSlug,
};
