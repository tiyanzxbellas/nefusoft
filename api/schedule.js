// api/schedule.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const schedRes = await fetch('https://www.sankavollerei.com/anime/samehadaku/schedule').then(r => r.json());
    const days = schedRes.data?.days || [];

    // Flatten semua hari jadi satu list, tambahin field day
    const allAnime = days.flatMap(d =>
      d.animeList.map(a => ({
        title: a.title,
        poster: a.poster,
        slug: a.animeId,         // pakai animeId sebagai slug
        genre: a.genres || null,
        type: a.type || null,
        score: a.score || null,
        day: d.day,              // hari tayang
        estimation: a.estimation || null,
        status: 'ONGOING',
      }))
    );

    res.json({ status: 200, data: allAnime });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
}
