import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { saveHistoryItem, getHistory } from '../utils/historyManager';
import { isFavorite, saveFavorite, removeFavorite } from '../utils/favoritesManager';
import { fetchAnime, fetchEpisode, fetchServer, fetchPopular, fetchComplete } from '../utils/api';

const ShimmerEffect = () => (
  <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />
);

const WatchSkeleton = () => (
  <div className="animate-pulse w-full">
    <div className="w-full aspect-video bg-[#16161a] rounded-sm relative overflow-hidden mb-4 flex flex-col items-center justify-center border border-white/5">
      <ShimmerEffect />
      <img src="/img/kaguya.webp" alt="Loading" className="w-24 md:w-32 object-contain relative z-20 mb-4 opacity-50" />
      <p className="text-[#F6CF80] text-xs md:text-sm font-bold text-center px-4 relative z-20">sabar yaa, server kami butuh waktu untuk merespon 😖</p>
    </div>
    <div className="flex flex-col gap-3 w-full mb-8">
      <div className="flex gap-3 w-full">
        <div className="flex-1 h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
        <div className="flex-1 h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
      </div>
      <div className="w-full h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
    </div>
    <div className="bg-[#16161a] p-5 md:p-6 rounded-xl border border-white/5 mb-8 relative overflow-hidden shadow-xl h-28 md:h-24"><ShimmerEffect /></div>
    <div className="bg-[#16161a] p-4 md:p-6 rounded-sm border border-white/5 mb-8 relative overflow-hidden shadow-xl">
      <ShimmerEffect />
      <div className="w-32 h-4 bg-white/10 rounded mb-4"></div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(45px,1fr))] gap-2">
        {[...Array(15)].map((_, i) => <div key={i} className="aspect-square bg-white/5 rounded-sm shrink-0"></div>)}
      </div>
    </div>
    <div className="bg-[#16161a] rounded-sm border border-white/5 p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden mb-10 shadow-xl">
      <ShimmerEffect />
      <div className="w-32 md:w-48 aspect-[3/4.2] bg-white/5 rounded-sm shrink-0 z-10 shadow-2xl mx-auto md:mx-0"></div>
      <div className="flex flex-col flex-1 w-full gap-4 z-10 items-center md:items-start mt-2">
        <div className="w-3/4 h-6 md:h-8 bg-white/10 rounded-sm mb-1"></div>
        <div className="flex gap-2 mb-4">
          <div className="w-12 h-5 bg-white/10 rounded-sm"></div>
          <div className="w-16 h-5 bg-white/10 rounded-sm"></div>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-sm"></div>
        <div className="w-full h-2.5 bg-white/5 rounded-sm"></div>
        <div className="w-4/5 h-2.5 bg-white/5 rounded-sm mb-6"></div>
      </div>
    </div>
  </div>
);

// Slug episode API Sanka baru diakhiri suffix, contoh:
//   "hykno-s3-episode-6-sub-indo" → episode 6 dari anime "hyakkano-s3-sub-ind"
// Format lama: "...-episode-6". Regex ini menangkap keduanya.
// CATATAN: prefix episode-slug TIDAK SELALU sama dengan anime-slug,
// jadi animeId asli di-resolve dari response endpoint episode (field animeId).
const EP_SLUG_RE = /^(.*)-episode-(\d+)(?:-[a-z0-9-]*)?$/i;

const Watch = () => {
  const { slug, episode: episodeParam } = useParams(); // episodeParam = nomor (link History: /anime/:id/:no)
  const [animeSlug, setAnimeSlug] = useState(null); // animeId hasil resolve
  const navigate = useNavigate();
  // Cache anime detail per animeId — ganti episode tidak perlu fetch ulang detail
  const animeCacheRef = useRef(new Map());

  const [anime, setAnime] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpId, setCurrentEpId] = useState(null);
  const [servers, setServers] = useState([]);
  const [downloadServers, setDownloadServers] = useState([]);
  const [nextSlug, setNextSlug] = useState(null);
  const [prevSlug, setPrevSlug] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEpLoading, setIsEpLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [autoNext, setAutoNext] = useState(() => localStorage.getItem('nefusoft_autonext') === 'true');
  const [isFavorited, setIsFavorited] = useState(false);

  const currentEpNum = episodes.find(e => e.id === currentEpId)?.index
    || currentEpId?.match(/-episode-(\d+)(?:-[a-z0-9-]*)?$/i)?.[1]
    || '?';

  const updateMetaTags = (title, desc, image) => {
    document.title = title;
    const tags = [
      { attr: 'property', key: 'og:title', val: title },
      { attr: 'property', key: 'og:description', val: desc },
      { attr: 'property', key: 'og:image', val: image },
      { attr: 'name', key: 'twitter:title', val: title },
      { attr: 'name', key: 'twitter:description', val: desc },
      { attr: 'name', key: 'twitter:image', val: image },
    ];
    tags.forEach(({ attr, key, val }) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', val);
    });
  };

  const applyEpData = (epData, epSlug) => {
    // epData dari adapter sudah dalam shape lama: { stream_links, download_links, next_slug, prev_slug }
    const streamList = epData.stream_links || epData.server || [];
    const dlList = epData.download_links || [];
    const svrs = streamList.map((s, i) => ({ id: s.server || String(i), server: s.server || 'Server ' + (i + 1), link: s.url || s.link || '' }));
    const dls = dlList.map((s, i) => ({ id: s.server || String(i), server: s.server || 'Download ' + (i + 1), link: s.url || s.link || '' }));
    setServers(svrs);
    setDownloadServers(dls);
    setSelectedServer(svrs[0] || null);
    setNextSlug(epData.next_slug || null);
    setPrevSlug(epData.prev_slug || null);
    setCurrentEpId(epSlug);
  };

  // Resolve serverId (kalau ada) ke URL embed sebenarnya
  const resolveStreamLinks = async (epData) => {
    if (!epData || !epData.stream_links) return epData;
    const resolved = await Promise.all(
      epData.stream_links.map(async (s) => {
        if (s.url) return s; // sudah ada URL
        if (s.serverId) {
          try {
            const realUrl = await fetchServer(s.serverId);
            return { ...s, url: realUrl || '' };
          } catch (e) {
            return { ...s, url: '' };
          }
        }
        return s;
      })
    );
    return { ...epData, stream_links: resolved };
  };

  // Helper: ambil data Jikan dari hasil search, cari exact match dulu
  const extractJikanData = (jikanRes, title) => {
    const results = jikanRes?.data || [];
    if (!results.length) return {};

    const titleLower = title.toLowerCase();
    const match = results.find(a =>
      a.title?.toLowerCase() === titleLower ||
      a.title_english?.toLowerCase() === titleLower ||
      a.title_japanese?.toLowerCase() === titleLower
    ) || results[0]; // fallback ke index 0

    return {
      studio: match.studios?.[0]?.name || null,
      year: match.year || null,
      day: match.broadcast?.day || null,
      status: match.status || null, 
      type: match.type || null,
      aired_start: match.aired?.prop?.from?.year         // ← tambah
      ? `${match.aired.prop.from.year}` : null,
    };
  };

  // Main fetch — reaktif terhadap perubahan slug URL (termasuk ganti episode).
  //
  // Alur:
  //   A) URL episode ("…-episode-6-sub-indo")
  //      → fetchEpisode(slug) DULU untuk resolve animeId asli (field animeId),
  //      → fetchAnime(animeId) untuk detail + daftar episode.
  //   B) URL anime murni ("hyakkano-s3-sub-ind")
  //      → fetchAnime(slug), lalu redirect ke episode 1 — effect ini re-run
  //        dengan slug episode (alur A). Detail anime di-cache supaya tidak
  //        di-fetch ulang setiap ganti episode.
  useEffect(() => {
    if (!slug) return;
    window.scrollTo(0, 0);

    let cancelled = false;

    const load = async () => {
      const epMatch = slug.match(EP_SLUG_RE);
      const isEpisodeSlug = !!epMatch;

      setServers([]);
      setSelectedServer(null);
      // Ganti episode saat sudah nonton → loader kecil di player;
      // sisanya (kunjungan baru / ganti judul) → skeleton penuh.
      if (isEpisodeSlug && anime) setIsEpLoading(true);
      else setIsLoading(true);

      try {
        // 1) Resolve animeId (via response episode kalau URL adalah episode)
        let epDataRaw = null;
        let animeId = slug;
        if (isEpisodeSlug) {
          epDataRaw = await fetchEpisode(slug).catch(() => null);
          animeId = epDataRaw?.animeId || epMatch[1] || slug;
        }
        if (cancelled) return;
        setAnimeSlug(animeId);

        // Buat query Jikan dari animeId (strip suffix bahasa, ganti - jadi spasi)
        const jikanQuery = encodeURIComponent(
          animeId.replace(/-sub-?indo?$/i, '').replace(/-/g, ' ')
        );

        // 2) Detail anime (cache) + rekomendasi + Jikan berjalan parallel
        const cached = animeCacheRef.current.get(animeId) || null;
        const [animeData, popularData, jikanRes] = await Promise.all([
          cached ? Promise.resolve(cached) : fetchAnime(animeId).catch(() => null),
          fetchPopular(1).catch(() => []),
          fetch(`https://api.jikan.moe/v4/anime?q=${jikanQuery}&limit=5`)
            .then(r => r.json()).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        const data = animeData; // adapter sudah return object langsung, bukan { data }
        if (data) {
          animeCacheRef.current.set(animeId, data);

          // ✅ Ambil data Jikan untuk field yang kosong
          const jikan = extractJikanData(jikanRes, data.title);

          // ✅ Merge: prioritas data API sendiri, Jikan hanya fallback
          const mergedData = {
            ...data,
            studio: data.studio || jikan.studio || null,
            year: data.year || jikan.year || null,
            day: data.day || jikan.day || null,
            status: data.status || jikan.status || null,
            type: data.type || jikan.type || null,
            aired_start: data.aired_start || jikan.aired_start || null,
          };

          setAnime(mergedData);

          // data.episodes / data.episode_list sudah di-normalisasi oleh adapter.
          // API mengembalikan list TERBALIK (episode terbaru dulu) → sort ascending.
          const epList = data.episodes || data.episode_list || [];
          const normalizedEps = epList
            .map((ep, i) => {
              const s = ep.eps_slug || ep.slug || ep.id || '';
              const num =
                (ep.eps != null ? String(ep.eps) : null) ||
                ep.eps_title?.match(/episode\s*(\d+)/i)?.[1] ||
                s.match(/-episode-(\d+)(?:-[a-z0-9-]*)?$/i)?.[1] ||
                String(i + 1);
              return { id: s, slug: s, index: parseInt(num) || (i + 1), title: ep.eps_title || '' };
            })
            .sort((a, b) => a.index - b.index);
          setEpisodes(normalizedEps);

          updateMetaTags(
            `Tonton ${data.title} - NefuSoft`,
            data.synopsis ? data.synopsis.substring(0, 150) + '...' : 'Streaming anime subtitle Indonesia gratis.',
            data.poster
          );

          if (isEpisodeSlug) {
            if (epDataRaw) {
              const resolved = await resolveStreamLinks(epDataRaw);
              if (!cancelled) applyEpData(resolved, slug);
            } else {
              // Episode tidak ditemukan → kosongkan player tapi tetap tampilkan detail
              applyEpData({ stream_links: [], download_links: [], next_slug: null, prev_slug: null }, slug);
            }
          } else if (normalizedEps.length > 0) {
            // Anime page → arahkan ke episode 1 (atau nomor episode dari URL,
            // mis. link "Lanjutkan" dari History /anime/:id/:no).
            // Setelah navigate, effect re-run dengan slug episode (alur A).
            let target = normalizedEps[0];
            if (episodeParam) {
              const num = parseInt(episodeParam, 10);
              const found = normalizedEps.find((e) => e.index === num);
              if (found) target = found;
            }
            if (target.slug) navigate(`/anime/${target.slug}`, { replace: true });
          }
        }

        // Rekomendasi (popular)
        const recData = Array.isArray(popularData) ? popularData : [];
        if (!cancelled) setRecommendations(recData.slice(0, 5));
      } catch (e) {
        if (!cancelled) console.error('Watch load failed', e);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsEpLoading(false);
        }
      }
    };

    load();

    return () => { cancelled = true; };
  }, [slug, episodeParam]);

  // Judul & meta default dipulihkan saat keluar halaman nonton
  useEffect(() => {
    return () => {
      updateMetaTags(
        'NefuSoft - Streaming Anime Sub Indo Gratis',
        'Nonton ribuan anime subtitle Indonesia secara gratis tanpa gangguan iklan di NefuSoft dengan kualitas tinggi.',
        'https://raw.githubusercontent.com/alip-jmbd/alipp/main/icons-full.jpg'
      );
    };
  }, []);

  // Fetch episode saat ganti episode
  // Ganti episode → cukup perbarui URL. Effect [slug] di atas yang fetch datanya,
  // jadi tidak ada double-request dan loading state terpusat di satu tempat.
  const changeEpisode = (epObj) => {
    const epSlug = epObj.slug || epObj.id;
    if (!epSlug || epSlug === slug) return;
    setIsEpLoading(true);
    setServers([]);
    setSelectedServer(null);
    navigate(`/anime/${epSlug}`, { replace: true });
  };

  const handlePrev = () => { if (prevSlug) changeEpisode({ slug: prevSlug }); };
  const handleNext = () => { if (nextSlug) changeEpisode({ slug: nextSlug }); };

  const toggleAutoNext = () => {
    setAutoNext(prev => { const val = !prev; localStorage.setItem('nefusoft_autonext', val); return val; });
  };

  // Favorites
  useEffect(() => {
    if (!animeSlug) return;
    const animeId = animeSlug;
    const handleFavUpdate = () => { setIsFavorited(isFavorite(animeId)); };
    setIsFavorited(isFavorite(animeId));
    window.addEventListener('nefusoft-favorites-updated', handleFavUpdate);
    return () => { window.removeEventListener('nefusoft-favorites-updated', handleFavUpdate); };
  }, [animeSlug]);

  useEffect(() => {
    return () => {
      window.__CURRENT_ANIME__ = null;
      window.dispatchEvent(new Event('nefusoft-anime-updated'));
    };
  }, []);

  const toggleFavorite = () => {
    if (!anime) return;
    const animePayload = {
      anime_id: animeSlug,
      anime_slug: animeSlug,
      anime_title: anime.title,
      anime_image: anime.poster,
      type: anime.type,
      status: anime.status,
    };
    if (isFavorited) {
      removeFavorite(animeSlug);
      setToast('Dihapus dari Favorit!');
    } else {
      saveFavorite(animePayload);
      setToast('Ditambahkan ke Favorit!');
    }
    setTimeout(() => setToast(''), 3000);
  };

  // Update __CURRENT_ANIME__ for Navbar favorite button
  useEffect(() => {
    if (anime) {
      window.__CURRENT_ANIME__ = {
        anime_id: animeSlug,
        anime_slug: animeSlug,
        anime_title: anime.title,
        anime_image: anime.poster,
        type: anime.type,
        status: anime.status,
      };
      window.dispatchEvent(new Event('nefusoft-anime-updated'));
    }
  }, [anime, animeSlug]);

  // Save watch history on episode change and periodically
  useEffect(() => {
    if (!anime || !currentEpId) return;
    const interval = setInterval(() => {
      const iframe = document.querySelector('iframe');
      // Save basic history entry
      saveHistoryItem({
        anime_id: animeSlug,
        anime_slug: animeSlug,
        anime_title: anime.title,
        anime_image: anime.poster,
        episode_index: currentEpNum,
        episode_id: currentEpId,
        current_time: 1,
        duration: 24 * 60,
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [anime, currentEpId, currentEpNum, animeSlug]);

  const getProxyUrl = (url) => url ? `https://cf.elainaa.workers.dev/${url}` : '';

  const handleShare = async (platform) => {
    const url = window.location.href;
    const textMsg = `Tonton ${anime?.title || 'Anime'} di NefuSoft, Gratis & Tanpa Iklan !!`;
    const encodedText = encodeURIComponent(textMsg);
    const encodedUrl = encodeURIComponent(url);
    if (platform === 'api' && navigator.canShare) {
      try {
        if (anime?.poster) {
          const response = await fetch(getProxyUrl(anime.poster));
          const blob = await response.blob();
          const file = new File([blob], 'cover.jpg', { type: blob.type });
          if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'NefuSoft', text: `${textMsg}\n\nLink: ${url}` }); return; }
        }
        await navigator.share({ title: 'NefuSoft', text: textMsg, url });
      } catch (e) {}
    } else if (platform === 'copy') {
      try { await navigator.clipboard.writeText(`${textMsg} \n\n${url}`); setToast('Tautan berhasil disalin!'); setTimeout(() => setToast(''), 3000); } catch (e) {}
    } else if (platform === 'fb') { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank'); }
    else if (platform === 'x') { window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank'); }
    else if (platform === 'tg') { window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'); }
  };

  const downloadAnime = (server) => {
    const a = document.createElement('a');
    a.href = getProxyUrl(server.link);
    a.download = `${anime?.title || 'Anime'} - Episode ${currentEpNum} (${server.server}).mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-nunito selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; }
      `}</style>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black font-black text-xs md:text-sm px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(246,207,128,0.3)] z-[999] animate-[fadeIn_0.3s_ease-out]">
          {toast}
        </div>
      )}

      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 md:px-6">
        {isLoading ? <WatchSkeleton /> : (
          <>
            {/* Player */}
            <div className="bg-[#16161a] p-1.5 md:p-2 rounded-sm border border-white/5 mb-3 shadow-2xl">
              <div className="relative w-full aspect-video bg-black overflow-hidden">
                {isEpLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                    <img src="/img/kaguya.webp" alt="Loading" className="w-24 md:w-32 animate-pulse mb-4 object-contain" />
                    <p className="text-[#F6CF80] text-xs md:text-sm font-bold text-center px-4 animate-pulse">sabar yaa, server kami butuh waktu untuk merespon 😖</p>
                  </div>
                ) : selectedServer ? (
                  <iframe
                    key={selectedServer.id + selectedServer.link}
                    src={selectedServer.link}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture"
                    referrerPolicy="no-referrer"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {anime?.poster && <img src={anime.poster} referrerPolicy="no-referrer" alt="Poster" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                    <span className="relative z-10 text-white/50 text-xs font-bold">video tidak tersedia</span>
                  </div>
                )}
              </div>
            </div>

            {/* Server selector */}
            {servers.length > 1 && (
              <div className="bg-[#16161a] border border-white/5 rounded-sm p-3 md:p-4 mb-3 shadow-xl">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Pilih Server</p>
                <div className="flex flex-wrap gap-2">
                  {servers.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedServer(s)}
                      className={`px-3 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider transition-all border ${
                        selectedServer?.id === s.id
                          ? 'bg-[#F6CF80] text-black border-[#F6CF80]'
                          : 'bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {s.server}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prev / Next / AutoNext */}
            <div className="flex flex-col gap-3 w-full mb-8">
              <div className="flex gap-3 w-full">
                <button onClick={handlePrev} disabled={!prevSlug} className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 py-3 md:py-4 rounded-lg transition-all disabled:opacity-30 text-white group">
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  <span className="text-sm md:text-base font-black">Episode Sebelumnya</span>
                </button>
                <button onClick={handleNext} disabled={!nextSlug} className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-[#F6CF80]/10 border border-[#F6CF80]/40 py-3 md:py-4 rounded-lg transition-all disabled:opacity-30 text-[#F6CF80] group">
                  <span className="text-sm md:text-base font-black">Episode Selanjutnya</span>
                  <svg className="w-5 h-5 text-[#F6CF80]/50 group-hover:text-[#F6CF80] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              <button onClick={toggleAutoNext} className={`w-full flex flex-col items-center justify-center gap-1 py-3 md:py-4 rounded-lg transition-all border ${autoNext ? 'bg-transparent border-[#F6CF80]/40 text-[#F6CF80]' : 'bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:border-white/40 hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    {autoNext ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 8l6 4-6 4V8z" />}
                  </svg>
                  <span className="text-sm md:text-base font-black uppercase tracking-wider">AutoNext {autoNext ? 'ON' : 'OFF'}</span>
                </div>
                <span className={`text-[10px] ${autoNext ? 'text-[#F6CF80]/70' : 'text-white/40'} font-bold lowercase`}>hidupkan untuk memutar otomatis episode selanjutnya</span>
              </button>
            </div>

            {/* Share */}
            <div className="relative bg-[#16161a] p-5 md:p-6 rounded-xl border border-white/5 mb-8 overflow-hidden shadow-xl">
              <div className="absolute inset-0 z-0">
                <img src={anime?.poster} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/90 to-transparent"></div>
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-white font-black uppercase text-sm md:text-base mb-1 tracking-tight">Sebarkan Keseruan Ini!</h3>
                  <p className="text-white/60 text-[10px] md:text-xs font-medium">Bagikan keseruan nonton anime ini ke teman-temanmu!</p>
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  <button onClick={() => handleShare('copy')} className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-black text-[11px] text-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    Salin Link
                  </button>
                  <button onClick={() => handleShare('fb')} className="bg-[#1877F2]/10 hover:bg-[#1877F2] border border-[#1877F2]/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                    <svg className="w-3.5 h-3.5 fill-[#1877F2] group-hover:fill-white transition-colors" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </button>
                  <button onClick={() => handleShare('x')} className="bg-white/5 hover:bg-white border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                    <svg className="w-3.5 h-3.5 fill-white group-hover:fill-black transition-colors" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                  <button onClick={() => handleShare('tg')} className="bg-[#229ED9]/10 hover:bg-[#229ED9] border border-[#229ED9]/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                    <svg className="w-3.5 h-3.5 fill-[#229ED9] group-hover:fill-white transition-colors" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 2.022-.963 6.925-1.36 9.194-.167.957-.5 1.28-.823 1.312-.738.073-1.303-.482-2.02-.953-1.121-.735-1.754-1.194-2.844-1.91-.122-.08-.266-.174-.407-.272-1.16-.807-.444-1.251.275-1.996.188-.195 3.461-3.17 3.523-3.44.008-.034.016-.159-.06-.225-.074-.066-.183-.043-.263-.025-.114.025-1.91 1.215-5.394 3.565-.51.35-1.02.522-1.479.513-.412-.008-1.206-.233-1.796-.425-2.008-.65-2.585-1.077-2.585-1.077-.286-.226.541-1.042 1.488-1.42 5.093-2.028 8.683-3.526 10.771-4.394 1.078-.445 1.583-.618 1.91-.62z"/></svg>
                  </button>
                  <button onClick={() => handleShare('api')} className="bg-white/5 hover:bg-white hover:text-black border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-black text-[11px] text-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    Lainnya
                  </button>
                </div>
              </div>
            </div>

            {/* Daftar Episode */}
            <div className="mb-8 bg-[#16161a] rounded-sm border border-white/5 p-4 md:p-6 shadow-xl">
              <h3 className="text-white font-black uppercase text-sm mb-4 tracking-wider">Daftar Episode</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(45px,1fr))] gap-2 max-h-56 overflow-y-auto pr-2">
                {episodes.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => changeEpisode(ep)}
                    className={`aspect-square flex items-center justify-center rounded-sm text-xs font-black transition-all shadow-sm ${
                      currentEpId === ep.id
                        ? 'bg-[#F6CF80] text-black shadow-[0_0_15px_rgba(246,207,128,0.4)]'
                        : 'bg-[#0a0a0c] border border-white/5 text-white/60 hover:border-white/20 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {ep.index}
                  </button>
                ))}
              </div>
            </div>

            {/* Anime Info */}
            {anime && (
              <div className="mb-8 relative bg-[#16161a] rounded-sm border border-white/5 overflow-hidden shadow-xl">
                <div className="absolute inset-0 z-0">
                  <img src={anime.poster} referrerPolicy="no-referrer" alt="Banner" className="w-full h-full object-cover blur-md opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#16161a] via-[#16161a]/90 to-transparent"></div>
                </div>
                <div className="relative z-10 p-6 flex flex-col md:flex-row gap-6 w-full items-center md:items-start">
                  <img src={anime.poster} referrerPolicy="no-referrer" alt={anime.title} className="w-32 md:w-48 aspect-[3/4.2] object-cover rounded-sm shadow-[0_15px_30px_rgba(0,0,0,0.5)] shrink-0" />
                  <div className="flex flex-col flex-1 w-full text-center md:text-left">
                    <h2 className="text-xl md:text-3xl font-black text-white mb-2 leading-tight tracking-tighter">{anime.title}</h2>
                    <p className="text-white/50 text-[10px] md:text-xs mb-5 font-bold uppercase tracking-widest">{anime.synonyms}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
                      <span className="bg-[#F6CF80] text-black text-[9px] px-2.5 py-1 rounded-sm uppercase font-black tracking-widest">{anime.type}</span>
                      <span className="bg-white/10 text-white/80 text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold tracking-widest border border-white/5">{anime.status}</span>
                      <span className="bg-white/10 text-white/80 text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold tracking-widest border border-white/5">{anime.aired_start || '?'}</span>
                      {anime.favorites !== undefined && anime.favorites !== null && (
                        <span className="bg-[#fbbf24]/10 text-[#fbbf24] text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold flex items-center gap-1.5 border border-[#fbbf24]/20">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                          {anime.favorites}
                        </span>
                      )}
                      <button
                        onClick={toggleFavorite}
                        className={`text-[9px] px-2.5 py-1 rounded-sm uppercase font-black tracking-widest flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isFavorited
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {isFavorited ? 'Favorit' : 'Tambah Favorit'}
                      </button>
                    </div>
                    <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-8 font-medium">{anime.synopsis}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-[10px] md:text-xs">
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Studio</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.studio || '?'}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Tahun</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.year || '?'}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Genre</span><span className="text-[#F6CF80] font-bold flex-1 text-right md:text-left">{Array.isArray(anime.genres) ? anime.genres.join(', ') : (anime.genre || '-')}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Tayang</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.day || '?'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Download */}
            {downloadServers.length > 0 && (
              <div className="mb-10 bg-[#16161a] rounded-sm border border-white/5 p-4 md:p-6 shadow-xl">
                <div className="flex flex-col mb-4">
                  <h3 className="text-white font-black uppercase text-xs md:text-sm tracking-wider">Download Episode {currentEpNum}</h3>
                  <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest mt-1">Pilih server download</span>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {downloadServers.map(s => (
                    <button key={s.id} onClick={() => downloadAnime(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0c] border border-white/10 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors rounded-sm font-black text-[10px] md:text-xs text-white tracking-widest shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      {s.server}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Rekomendasi */}
        {!isLoading && recommendations.length > 0 && (
          <div className="mb-12">
            <h3 className="text-white font-black uppercase text-sm mb-5 tracking-wider">Rekomendasi Lainnya</h3>
            <div className="flex flex-col gap-3">
              {recommendations.map((a) => (
                <div key={a.id} onClick={() => navigate(`/anime/${a.slug}`)} className="group cursor-pointer relative h-20 md:h-24 rounded-sm bg-[#16161a] border border-white/5 flex items-center px-4 overflow-hidden transition-transform active:scale-[0.98]">
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-1/3 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/80 to-transparent z-10"></div>
                    <img src={a.poster} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-500" />
                  </div>
                  <div className="relative z-20 flex items-center gap-4 w-full">
                    <img src={a.poster} referrerPolicy="no-referrer" className="w-12 md:w-16 aspect-[3/4.2] object-cover rounded-sm shadow-lg group-hover:scale-105 transition-transform" />
                    <div className="flex flex-col">
                      <h3 className="text-white font-bold text-[11px] md:text-sm line-clamp-1 group-hover:text-[#F6CF80] transition-colors">{a.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">{a.type || 'TV'}</span>
                        {a.status && (
  <span className="bg-white/10 text-white/80 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">{a.status}</span>
)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Watch;
