/**
 * Lazy Supabase client.
 * ----------------------------------------------------------------
 * Modul ini TIDAK meng-import `@supabase/supabase-js` secara statis.
 * SDK Supabase (±194 kB / ±49 kB gzip) hanya dibutuhkan untuk fitur
 * auth (login/profil) dan live-chat — BUKAN untuk render konten anime.
 *
 * Dengan dynamic import, SDK dipisah menjadi chunk terpisah yang baru
 * dimuat ketika benar-benar dibutuhkan. Ini membuat bundle awal (critical
 * path FCP/LCP) jauh lebih kecil dan halaman pertama terasa jauh lebih
 * cepat.
 *
 * Contoh pemakaian:
 *   import { getSupabase } from '../utils/supabaseLazy';
 *   const supabase = await getSupabase();
 */
let supabasePromise = null;

export const getSupabase = () => {
  if (!supabasePromise) {
    supabasePromise = import('./supabaseClient').then((m) => m.supabase);
  }
  return supabasePromise;
};

export default getSupabase;
