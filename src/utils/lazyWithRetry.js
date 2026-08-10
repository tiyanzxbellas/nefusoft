import { lazy } from 'react';

/**
 * Enhanced lazy with retry and automatic chunk reload handling.
 * Resolves the common Vite "Failed to fetch dynamically imported module"
 * or "Loading chunk failed" issues by retrying the import and gracefully reloading
 * if a new deployment or temporary network glitch occurs.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('nefusoft_chunk_reloaded') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('nefusoft_chunk_reloaded', 'false');
      return component;
    } catch (error) {
      console.warn('Lazy chunk load failed, attempting recovery:', error);

      // If page has not been refreshed yet in this session for this error, auto-reload once
      if (!pageHasBeenForceRefreshed) {
        window.sessionStorage.setItem('nefusoft_chunk_reloaded', 'true');
        window.location.reload();
        return new Promise(() => {}); // Suspend while browser reloads
      }

      // If already reloaded once, try dynamic import retry after a short delay
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retryResult = await componentImport();
        window.sessionStorage.setItem('nefusoft_chunk_reloaded', 'false');
        return retryResult;
      } catch (retryError) {
        window.sessionStorage.setItem('nefusoft_chunk_reloaded', 'false');
        throw retryError;
      }
    }
  });
}

export default lazyWithRetry;
