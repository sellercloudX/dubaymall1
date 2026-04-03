/**
 * SellerCloudX Extension — Auto-login from web app
 * Reads Supabase session from localStorage on sellercloudx.com
 * and forwards auth tokens to the background service worker.
 */

(function () {
  const STORAGE_KEY_PREFIX = 'sb-idcshubgqrzdvkttnslz-auth-token';

  function getSupabaseSession() {
    try {
      // Supabase stores session in localStorage with a specific key pattern
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('sb-') && key.includes('auth-token')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed?.access_token && parsed?.user?.id) {
            return {
              accessToken: parsed.access_token,
              userId: parsed.user.id,
              userEmail: parsed.user.email || '',
            };
          }
        }
      }
    } catch (e) {
      console.warn('[SCX] Failed to read Supabase session:', e);
    }
    return null;
  }

  function syncSession() {
    const session = getSupabaseSession();
    if (!session) return;

    // Check if extension already has this session
    chrome.storage.local.get(['userId', 'accessToken'], (stored) => {
      if (chrome.runtime.lastError) return;
      
      // Only update if different user or no session stored
      if (stored.userId === session.userId && stored.accessToken === session.accessToken) {
        return; // Already synced
      }

      console.log('[SCX] Auto-syncing session from web app for:', session.userEmail);
      
      // Save to extension storage
      chrome.storage.local.set({
        accessToken: session.accessToken,
        userId: session.userId,
        userEmail: session.userEmail,
      });

      // Notify background to connect WebSocket
      chrome.runtime.sendMessage({
        type: 'SCX_LOGIN',
        accessToken: session.accessToken,
        userId: session.userId,
      }, () => void chrome.runtime.lastError);
    });
  }

  // Also listen for postMessage from the web app (explicit token pass)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'SCX_AUTH_TOKEN' && event.data?.accessToken && event.data?.userId) {
      console.log('[SCX] Received auth token via postMessage');
      chrome.storage.local.set({
        accessToken: event.data.accessToken,
        userId: event.data.userId,
        userEmail: event.data.userEmail || '',
      });
      chrome.runtime.sendMessage({
        type: 'SCX_LOGIN',
        accessToken: event.data.accessToken,
        userId: event.data.userId,
      }, () => void chrome.runtime.lastError);
    }
  });

  // Sync on load
  syncSession();

  // Re-sync periodically (session refresh)
  setInterval(syncSession, 30000);

  // Listen for storage changes (Supabase session refresh)
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('auth-token')) {
      setTimeout(syncSession, 500);
    }
  });

  console.log('[SCX] SellerCloudX web app content script loaded');
})();
