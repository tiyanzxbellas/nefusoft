// api/schedule.js
// Serverless function untuk Vercel — proxy schedule API Sanka Vollerei
// Endpoint: /api/schedule
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // API baru: https://www.sankavollerei.web.id/anime/schedule
    // Return { data: [{ day, anime_list: [{ title, slug, poster, ... }] }] }
    const schedRes = await fetch('https://www.sankavollerei.web.id/anime/schedule').then(r => r.json());
    const days = Array.isArray(schedRes.data) ? schedRes.data : [];

    // Flatten semua hari jadi satu list, tambahin field day
    const allAnime = days.flatMap(d =>
      (d.anime_list || d.animeList || []).map(a => ({
        title: a.title,
        poster: a.poster,
        slug: a.slug || a.animeId,
        image_poster: a.poster,
        image_cover: a.poster,
        genre: a.genre || null,
        type: a.type || null,
        score: a.score || null,
        day: d.day, // hari tayang
        estimation: a.estimation || null,
        status: 'ONGOING',
      }))
    );

    res.json({ status: 200, data: allAnime });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
}
