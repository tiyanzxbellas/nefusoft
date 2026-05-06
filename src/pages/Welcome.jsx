import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const Welcome = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [animeCards, setAnimeCards] = useState([]);
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch('/anime/stream/popular')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setAnimeCards(list.slice(0, 20));
      })
      .catch(() => {
        fetch('/anime/stream/latest')
          .then(r => r.json())
          .then(d => {
            const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
            setAnimeCards(list.slice(0, 20));
          })
          .catch(() => {});
      });
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) { setLiveResults([]); return; }
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/anime/stream/search/${encodeURIComponent(searchQuery)}`).then(r => r.json());
        if (isMounted) setLiveResults(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      } catch (e) {
        if (isMounted) setLiveResults([]);
      }
    }, 350);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [searchQuery]);

  const navLinks = useMemo(() => [
    { label: 'Home', path: '/home', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
    { label: 'Explore', path: '/explore', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
    { label: 'Ongoing', path: '/ongoing', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Schedule', path: '/schedule', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> }
  ], []);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current) * 1.2;
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  const rots = [-6, 4, -3, 7, -5, 3, -8, 5, -2, 6, -4, 8, -7, 2, -5, 6, -3, 4, -6, 5];
  const yOffs = [0, -10, 6, -5, 8, -3, 4, -8, 3, -6, 7, -4, 5, -9, 2, -7, 6, -2, 8, -5];

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col text-white overflow-x-hidden">
      <style>{`
        @keyframes cardFloat {
          0%, 100% { transform: rotate(var(--cr)) translateY(0px); }
          50% { transform: rotate(var(--cr)) translateY(-9px); }
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-up-1 { animation: fadeUp 0.5s ease-out 0.05s both; }
        .fade-up-2 { animation: fadeUp 0.5s ease-out 0.18s both; }
        .fade-up-3 { animation: fadeUp 0.5s ease-out 0.3s both; }
        .card-scroll::-webkit-scrollbar { display: none; }
        .card-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .search-scroll::-webkit-scrollbar { width: 3px; }
        .search-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .anime-card { transition: transform 0.25s ease, box-shadow 0.25s ease, z-index 0s; }
        .anime-card:hover {
          transform: rotate(0deg) translateY(-14px) scale(1.07) !important;
          box-shadow: 0 28px 50px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(246,207,128,0.45) !important;
          z-index: 50 !important;
          position: relative;
        }
      `}</style>

      {/* NAV */}
      <nav className="w-full h-20 px-6 flex items-center justify-between shrink-0 z-50">
        <div className="cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/img/nefusoft.webp" alt="NefuSoft" className="w-14 object-contain" />
        </div>
        <div className="flex gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
          {navLinks.map((link, i) => (
            <button key={i} aria-label={link.label} onClick={() => navigate(link.path)} className="text-white/50 hover:text-[#F6CF80] transition-colors p-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">{link.icon}</svg>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 flex flex-col">

        {/* CARD SCROLL */}
        <div className="relative w-full" style={{ height: '210px' }}>
          <div className="absolute left-0 top-0 bottom-0 w-14 bg-gradient-to-r from-[#0a0a0c] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-[#0a0a0c] to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="card-scroll flex items-center gap-4 overflow-x-auto h-full px-10"
            style={{ cursor: 'grab', paddingTop: '18px', paddingBottom: '18px' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {animeCards.length === 0
              ? [...Array(14)].map((_, i) => (
                  <div key={i} className="shrink-0 w-[76px] aspect-[3/4.5] rounded-xl bg-white/5 animate-pulse"
                    style={{ transform: `rotate(${rots[i % 20]}deg) translateY(${yOffs[i % 20]}px)` }} />
                ))
              : animeCards.map((a, i) => {
                  const rot = rots[i % 20];
                  const yOff = yOffs[i % 20];
                  const dur = (4 + (i % 5) * 0.7).toFixed(1);
                  const delay = ((i % 7) * 0.4).toFixed(1);
                  return (
                    <div
                      key={a.slug || a.id || i}
                      className="anime-card shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.55)] cursor-pointer"
                      style={{
                        width: '76px',
                        transform: `rotate(${rot}deg) translateY(${yOff}px)`,
                        animation: `cardFloat ${dur}s ease-in-out ${delay}s infinite`,
                        '--cr': `${rot}deg`,
                      }}
                      onClick={() => navigate(`/anime/${a.slug || a.id}`)}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <img src={a.poster} referrerPolicy="no-referrer" draggable={false}
                        className="w-full aspect-[3/4.5] object-cover" loading="lazy" />
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* HERO TEXT + SEARCH */}
        <div className="flex flex-col items-start px-6 pt-5 pb-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-[#F6CF80]/10 border border-[#F6CF80]/20 rounded-full px-3 py-1 mb-4 fade-up-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F6CF80]" style={{ animation: 'blink 2s ease-in-out infinite' }} />
            <span className="text-[#F6CF80] text-[10px] font-black uppercase tracking-widest">Gratis & Tanpa Iklan</span>
          </div>

          <h1 className="text-[2rem] font-[900] leading-[1.1] tracking-tight mb-2 text-white fade-up-1">
            Nonton Anime<br /><span className="text-[#F6CF80]">Sub Indo</span> Sepuasnya
          </h1>
          <p className="text-white/35 text-xs font-medium leading-relaxed mb-5 fade-up-2">
            Ribuan judul anime, kualitas 360p–1080p, gratis tanpa gangguan.
          </p>

          {/* Search */}
          <div className="relative w-full fade-up-2">
            <div className="flex items-center bg-white/6 border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#F6CF80]/35 transition-all">
              <svg className="w-4 h-4 text-white/25 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="w-full bg-transparent text-white text-sm outline-none font-bold placeholder-white/20"
                placeholder="Cari anime favorit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(searchQuery ? `/explore?q=${searchQuery}` : '/home')}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/20 hover:text-white/50 ml-2 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {liveResults.length > 0 && (
              <div className="absolute top-[52px] inset-x-0 bg-[#16161a] border border-white/10 rounded-xl overflow-hidden z-[100] max-h-56 shadow-2xl overflow-y-auto search-scroll">
                {liveResults.map(r => (
                  <div key={r.slug || r.id} onClick={() => navigate(`/anime/${r.slug || r.id}`)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 border-b border-white/5 cursor-pointer transition-colors">
                    <img src={r.poster || r.image_poster} referrerPolicy="no-referrer" className="w-8 aspect-[3/4.5] object-cover rounded-md" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-white font-bold text-xs line-clamp-1">{r.title}</span>
                      <span className="text-white/30 text-[9px] font-bold uppercase mt-0.5">{r.type || r.status || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => navigate('/home')}
            className="fade-up-3 mt-5 bg-[#F6CF80] hover:bg-[#f0c85a] text-black font-black px-8 py-3 rounded-xl active:scale-95 transition-all shadow-[0_8px_24px_rgba(246,207,128,0.2)] tracking-wider text-xs uppercase flex items-center gap-2">
            Masuk Beranda
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ABOUT */}
        <div className="mt-4 mb-24 flex flex-col items-center text-center px-6">
          <img src="/img/kaguya.webp" alt="Kaguya" className="w-24 object-contain mb-5 drop-shadow-2xl" loading="lazy" />
          <h2 className="text-3xl font-[900] tracking-tighter mb-3">Nefu<span className="text-[#F6CF80]">Soft</span></h2>
          <p className="text-white/35 text-sm font-medium leading-relaxed max-w-xs">
            NefuSoft menyediakan akses menonton ribuan judul anime secara gratis tanpa gangguan iklan.
          </p>
        </div>
      </main>

      <footer className="w-full py-6 px-6 border-t border-white/5 flex flex-col items-center">
        <p className="text-[10px] text-white/25 font-bold leading-relaxed max-w-2xl text-center tracking-wide">
          NefuSoft adalah platform streaming anime pihak ketiga. Kami tidak mengunggah atau menyimpan file video apa pun di server kami.
        </p>
      </footer>
    </div>
  );
};

export default Welcome;
