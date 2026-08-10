const LOCAL_FAVORITES_KEY = 'nefusoft_favorites';

function normalizeFavorite(item) {
  return {
    anime_id: item.anime_id || item.animeId || '',
    anime_slug: item.anime_slug || item.animeSlug || '',
    anime_title: item.anime_title || item.animeTitle || '',
    anime_image: item.anime_image || item.animeImage || '',
    type: item.type || '',
    status: item.status || '',
    added_at: item.added_at || item.addedAt || new Date().toISOString(),
  };
}

export function getFavorites() {
  try {
    const localData = JSON.parse(localStorage.getItem(LOCAL_FAVORITES_KEY) || '[]');
    const normalized = localData.map(normalizeFavorite);
    return normalized.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
  } catch (err) {
    console.error('Failed to get favorites from local storage:', err);
    return [];
  }
}

export function saveFavorite(anime) {
  try {
    const normalized = normalizeFavorite({
      ...anime,
      added_at: new Date().toISOString()
    });

    let favorites = getFavorites();
    // Remove if already exists to move to top
    favorites = favorites.filter(f => f.anime_id !== normalized.anime_id);
    favorites.unshift(normalized);

    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
    // Dispatch global event for state reactivity across components
    window.dispatchEvent(new Event('nefusoft-favorites-updated'));
  } catch (err) {
    console.error('Failed to save favorite to local storage:', err);
  }
}

export function removeFavorite(animeId) {
  try {
    let favorites = getFavorites();
    favorites = favorites.filter(f => f.anime_id !== animeId);
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new Event('nefusoft-favorites-updated'));
  } catch (err) {
    console.error('Failed to remove favorite from local storage:', err);
  }
}

export function isFavorite(animeId) {
  try {
    const favorites = getFavorites();
    return favorites.some(f => f.anime_id === animeId);
  } catch (err) {
    console.error('Failed to check favorite status:', err);
    return false;
  }
}
