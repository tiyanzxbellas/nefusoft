const LOCAL_HISTORY_KEY = 'nefusoft_watch_history';

/**
 * Normalizes history items structure.
 */
function normalizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    anime_id: item.anime_id || item.animeId || '',
    anime_slug: item.anime_slug || item.animeSlug || '',
    anime_title: item.anime_title || item.animeTitle || '',
    anime_image: item.anime_image || item.animeImage || '',
    episode_index: item.episode_index !== undefined ? item.episode_index : (item.episodeIndex !== undefined ? item.episodeIndex : '1'),
    episode_id: item.episode_id || item.episodeId || '',
    current_time: item.current_time !== undefined ? item.current_time : (item.currentTime !== undefined ? item.currentTime : 0),
    duration: item.duration !== undefined ? item.duration : 0,
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
  };
}

/**
 * Get watch history strictly from local storage.
 */
export async function getHistory() {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    const localData = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(localData)) return [];
    const localHistory = localData.map(normalizeItem).filter(Boolean);
    // Sort local history by updated_at descending
    return localHistory.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (err) {
    console.error('Failed to get watch history from local storage:', err);
    return [];
  }
}

/**
 * Saves or updates a history item strictly in local storage.
 */
export async function saveHistoryItem(item) {
  try {
    if (!item) return;
    const normalized = normalizeItem({
      ...item,
      updated_at: new Date().toISOString(),
    });
    if (!normalized || !normalized.anime_id) return;

    let localHistory = await getHistory();
    if (!Array.isArray(localHistory)) localHistory = [];

    // Remove existing entry for same anime and same episode
    localHistory = localHistory.filter(i => !(i.anime_id === normalized.anime_id && String(i.episode_index) === String(normalized.episode_index)));

    // Add new to front
    localHistory.unshift(normalized);

    // Keep max 50 items
    if (localHistory.length > 50) {
      localHistory = localHistory.slice(0, 50);
    }

    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(localHistory));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }
  } catch (err) {
    console.error('Failed to save watch history to local storage:', err);
  }
}

/**
 * Removes history items of a specific anime_id strictly from local storage.
 * If episodeIndex is provided, removes only that episode.
 */
export async function deleteHistoryItem(animeId, episodeIndex) {
  try {
    if (!animeId) return;
    let localHistory = await getHistory();
    if (!Array.isArray(localHistory)) localHistory = [];
    if (episodeIndex !== undefined && episodeIndex !== null) {
      localHistory = localHistory.filter(i => !((i.anime_id || i.animeId) === animeId && String(i.episode_index || i.episodeIndex || '1') === String(episodeIndex)));
    } else {
      localHistory = localHistory.filter(i => (i.anime_id || i.animeId) !== animeId);
    }
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(localHistory));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }
  } catch (err) {
    console.error('Failed to delete history item from local storage:', err);
    throw err;
  }
}

/**
 * Clears entire watch history strictly from local storage.
 */
export async function clearAllHistory() {
  try {
    localStorage.removeItem(LOCAL_HISTORY_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }
  } catch (err) {
    console.error('Failed to clear watch history from local storage:', err);
    throw err;
  }
}
