// Smoke test: memastikan request() melewati CORS proxy chain dengan fallback.
// Jalankan: npx vite-node scripts/test-api-proxy.mjs
import { strict as assert } from 'node:assert';

// ---- Mock global.fetch sebelum import modul yang memakainya ----
const calls = [];
const MODE = process.argv[2] || 'fallback'; // 'fallback' | 'env-override' | 'direct' | 'timeout'

globalThis.fetch = async (url, opts = {}) => {
  calls.push(url);
  // simulasi abort signal kombinasi (timeout/proxy hang)
  if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException('Aborted', 'AbortError');
  if (MODE === 'fallback') {
    if (calls.length === 1) throw new TypeError('fetch failed'); // proxy #1 gagal total (network)
    if (calls.length === 2) return { ok: false, status: 500, statusText: 'Internal Server Error' }; // proxy #2 500
    return { ok: true, json: async () => ({ status: 'ok', data: { animeList: [{ title: 'X', poster: 'p', animeId: 'x' }] } }) }; // proxy #3 sukses
  }
  // semua sukses di percobaan pertama
  return { ok: true, json: async () => ({ status: 'ok', data: { animeList: [{ title: 'X', poster: 'p', animeId: 'x' }] } }) };
};

const api = await import('../src/utils/api.js');

const res = await api.fetchOngoing(1);
assert.equal(res[0].slug, 'x');
assert.equal(res[0].image_poster, 'p');

if (MODE === 'fallback') {
  assert.equal(calls.length, 3, `harus 3 percobaan, dapat ${calls.length}: ${calls.join(',')}`);
  assert.ok(calls[0].startsWith('https://cf.tiyanstores.workers.dev/?url='), `percobaan 1 harus worker project: ${calls[0]}`);
  assert.ok(calls[1].startsWith('https://corsproxy.io/?url='), `percobaan 2 harus corsproxy.io: ${calls[1]}`);
  assert.ok(calls[2].startsWith('https://api.allorigins.win/raw?url='), `percobaan 3 harus allorigins: ${calls[2]}`);
  assert.ok(calls[0].includes(encodeURIComponent('https://www.sankavollerei.web.id/anime/ongoing-anime?page=1')), 'URL target harus ter-encode di query proxy');
} else {
  assert.equal(calls.length, 1, `harus 1 percobaan, dapat ${calls.length}`);
  assert.ok(calls[0].startsWith('http'), calls[0]);
}

// getApiUrl: default/env-override → pakai proxy utama; 'direct' → URL polos
if (MODE === 'direct') {
  assert.equal(api.getApiUrl('https://example.com/a?b=c'), 'https://example.com/a?b=c');
} else if (MODE === 'env-override') {
  assert.ok(api.getApiUrl('https://example.com/a?b=c').startsWith('https://proxyku.example/?u='), 'getApiUrl harus pakai proxy dari VITE_CORS_PROXY');
} else {
  assert.ok(api.getApiUrl('https://example.com/a?b=c').startsWith('https://cf.tiyanstores.workers.dev/?url='));
}

console.log(`OK [${MODE}]  percobaan: ${calls.length}`);
calls.forEach((c, i) => console.log(`  #${i + 1} ${c.slice(0, 90)}`));
